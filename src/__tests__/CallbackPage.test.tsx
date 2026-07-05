/**
 * /auth/callback ルート (CallbackPage) の検証。
 * - 連携中表示は sessionStorage の provider で表示名を切り替える
 * - handleAuthCallback 成功 → ルートへフル遷移 (location.replace)
 * - 失敗 → classifyError が内部エラー文言を user 向け定型文に変換して表示
 */

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/oauth-web", () => ({
  handleAuthCallback: vi.fn(async () => {}),
  PROVIDER_KEY: "msp:oauth:provider",
}));

import { handleAuthCallback } from "../auth/oauth-web";
import { CallbackPage } from "../pages/CallbackPage";

const ORIGINAL_LOCATION = window.location;
const replace = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(handleAuthCallback).mockReset().mockResolvedValue(undefined);
  replace.mockReset();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { ...ORIGINAL_LOCATION, replace },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: ORIGINAL_LOCATION,
  });
});

describe("CallbackPage", () => {
  it("成功時: 連携中表示 → handleAuthCallback → ルートへ location.replace", async () => {
    render(<CallbackPage />);
    expect(screen.getByText(/アカウントに連携中/)).toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(handleAuthCallback).toHaveBeenCalledTimes(1);
  });

  it("sessionStorage の provider=microsoft なら「Outlook アカウントに連携中…」", () => {
    sessionStorage.setItem("msp:oauth:provider", "microsoft");
    render(<CallbackPage />);
    expect(screen.getByText("Outlook アカウントに連携中…")).toBeInTheDocument();
  });

  it("provider 不明なら「カレンダー アカウントに連携中…」", () => {
    render(<CallbackPage />);
    expect(screen.getByText("カレンダー アカウントに連携中…")).toBeInTheDocument();
  });

  it("state 不一致エラーはセキュリティ検証の定型文に変換して表示", async () => {
    vi.mocked(handleAuthCallback).mockRejectedValue(
      new Error("state が一致しません (CSRF の可能性があります)。"),
    );
    render(<CallbackPage />);
    expect(await screen.findByText("連携に失敗しました")).toBeInTheDocument();
    expect(
      screen.getByText("セキュリティ検証 (state) に失敗しました。もう一度やり直してください。"),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("exchange 失敗はサーバとのトークン交換失敗の定型文に変換", async () => {
    vi.mocked(handleAuthCallback).mockRejectedValue(
      new Error("/api/auth/exchange 失敗: 500 "),
    );
    render(<CallbackPage />);
    expect(
      await screen.findByText("サーバとのトークン交換に失敗しました。時間を置いて再試行してください。"),
    ).toBeInTheDocument();
  });

  it("未知のエラーは原文を出さず汎用文言にする", async () => {
    vi.mocked(handleAuthCallback).mockRejectedValue(new Error("secret internal detail"));
    render(<CallbackPage />);
    expect(
      await screen.findByText("連携に失敗しました。時間を置いて再度お試しください。"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/secret internal detail/)).not.toBeInTheDocument();
  });

  it("失敗画面にはトップに戻るリンクがある", async () => {
    vi.mocked(handleAuthCallback).mockRejectedValue(new Error("x"));
    render(<CallbackPage />);
    expect(await screen.findByRole("link", { name: "トップに戻ってやり直す" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
