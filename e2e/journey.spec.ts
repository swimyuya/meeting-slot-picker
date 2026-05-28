import { expect, test, type Page } from "@playwright/test";

// secrets.ts の localStorage フォールバックキー (非 Tauri 環境)。
const TOKEN_KEY = "meeting-slot-picker:secret:google_refresh_token";

/** ページ読み込み前に refresh_token を種まきして連携済み状態にする。 */
async function seedConnected(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "e2e-refresh-token");
  }, TOKEN_KEY);
}

test.describe("日程ピッカー 中核フロー (Web UI 層)", () => {
  // 外部 Google への通信はテストでは遮断し、ハーメチックに保つ
  // (.env.local の有無に依存しないようにする)。
  test.beforeEach(async ({ page }) => {
    await page.route(/googleapis\.com/, (route) => route.abort());
  });

  test("未連携時は連携案内 (ConnectPrompt) を表示する", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Google カレンダーと連携")).toBeVisible();
    await expect(page.getByRole("button", { name: /連携する/ })).toBeVisible();
  });

  test("枠選択 → 連続結合プレビュー → クリップボードへコピー", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await seedConnected(page);
    await page.goto("/");

    // グリッド描画 (時刻ガター 9:00) を待つ。
    await expect(page.getByText("9:00", { exact: true })).toBeVisible();

    // 先頭列の dayISO を取得し、9:00-9:30 と 9:30-10:00 を選択。
    const firstKey = await page.locator("[data-key]").first().getAttribute("data-key");
    const dayISO = firstKey!.split("#")[0];
    await page.locator(`[data-key="${dayISO}#0"]`).click();
    await page.locator(`[data-key="${dayISO}#1"]`).click();

    // 連続2枠は1範囲に結合され "…（曜）9:00-10:00" になる。
    const preview = page.getByLabel("コピー内容プレビュー");
    await expect(preview).toHaveValue(/（[日月火水木金土]）9:00-10:00$/);

    const previewText = await preview.inputValue();
    await page.getByRole("button", { name: /コピー（2枠）/ }).click();
    await expect(page.getByText(/コピーしました/)).toBeVisible();

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(previewText);
  });

  test("設定パネルを開閉できる", async ({ page }) => {
    await seedConnected(page);
    await page.goto("/");
    await expect(page.getByText("9:00", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "設定" }).click();
    await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
    await page.getByRole("button", { name: "キャンセル" }).click();
    await expect(page.getByText("9:00", { exact: true })).toBeVisible();
  });
});
