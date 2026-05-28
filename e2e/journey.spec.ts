import { expect, test, type Page } from "@playwright/test";

/**
 * ページ読み込み前に refresh_token を IndexedDB に種まきして連携済み状態にする。
 * Web 版は secrets を IndexedDB (DB: meeting-slot-picker, store: secrets) に保存する。
 */
async function seedConnected(page: Page) {
  await page.addInitScript(() => {
    return new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("meeting-slot-picker", 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("secrets")) {
          db.createObjectStore("secrets");
        }
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("secrets", "readwrite");
        tx.objectStore("secrets").put("e2e-refresh-token", "google_refresh_token");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  });
}

test.describe("日程ピッカー 中核フロー (Web UI 層)", () => {
  // 外部 Google / Vercel API へは遮断し、ハーメチックに保つ。
  test.beforeEach(async ({ page }) => {
    await page.route(/googleapis\.com/, (route) => route.abort());
    // /api/auth/refresh は Vercel Functions だが、E2E は localhost dev (1420) なので
    // 実体は無い。fetch が失敗しても useBusyTimes は events=[] で表示するため UI は動く。
    await page.route(/\/api\/auth\//, (route) => route.abort());
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
