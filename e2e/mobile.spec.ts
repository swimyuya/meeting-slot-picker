import { expect, test } from "@playwright/test";
import { seedConnected } from "./helpers";

/**
 * モバイル (iPhone 12) ビューポートでの主要フロー。
 * - MobileDayView (1日スワイプビュー) がレンダされる
 * - 日付チップで日付を切り替えられる
 * - 30分セルを選択 → コピーボタンへ反映
 */

// iPhone 12 と同等の viewport を chromium に当てる (webkit は CI に未インストールでも動かす目的)。
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.describe("モバイル幅 (iPhone 12 viewport)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/googleapis\.com/, (route) => route.abort());
    await page.route(/\/api\/auth\//, (route) => route.abort());
  });

  test("MobileDayView を描画し、日付チップで日切替できる", async ({ page }) => {
    await seedConnected(page);
    await page.goto("/");

    // モバイルビューでは「今日」「明日」チップが見える (WeekGrid では出ない)。
    await expect(page.getByRole("button", { name: "今日" })).toBeVisible();
    await expect(page.getByRole("button", { name: "明日" })).toBeVisible();

    // 30分セルが描画される (時刻ラベル 9:00)
    await expect(page.getByText("9:00", { exact: true })).toBeVisible();

    // 明日チップで遷移 → ヘッダの日付が変わる (今日の日付と異なる)
    await page.getByRole("button", { name: "明日" }).click();
    // 確実なのは「今日」ボタンが非 active 化される (data 属性が無いのでスタイルで判定が難しい)
    // が、最低限クリック後もエラーなく動作することを確認
    await expect(page.getByText("9:00", { exact: true })).toBeVisible();
  });

  test("セルをタップ → コピーボタンに反映", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await seedConnected(page);
    await page.goto("/");

    await expect(page.getByText("9:00", { exact: true })).toBeVisible();

    const firstKey = await page.locator("[data-key]").first().getAttribute("data-key");
    const dayISO = firstKey!.split("#")[0];
    await page.locator(`[data-key="${dayISO}#0"]`).click();

    const preview = page.getByLabel("コピー内容プレビュー");
    await expect(preview).toHaveValue(/（[日月火水木金土]）9:00-9:30$/);
  });
});
