import { expect, test } from "@playwright/test";

/**
 * 回帰テスト: ConnectPrompt の「clientId 未設定」警告が、実ウィンドウ幅 (880px) で
 * 横にはみ出さず折り返すこと。以前 max-w 未指定で左端が見切れるバグがあった。
 *
 * 注: この警告は VITE_GOOGLE_CLIENT_ID 未設定のときのみ表示される。
 * .env.local で設定済みの環境ではスキップする (CI/未設定環境で実行される)。
 */
test.describe("ConnectPrompt (実ウィンドウ幅 880px)", () => {
  test("clientId 未設定の警告が左右で見切れない", async ({ page }) => {
    await page.setViewportSize({ width: 880, height: 580 });
    await page.goto("/");
    const warn = page.getByText(/VITE_GOOGLE_CLIENT_ID/);
    test.skip(
      (await warn.count()) === 0,
      "clientId 設定済み (.env.local) のため警告が出ない → スキップ",
    );
    await expect(warn).toBeVisible();
    const box = await warn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0); // 左端で見切れない
    expect(box!.x + box!.width).toBeLessThanOrEqual(880); // 右端で見切れない
  });
});
