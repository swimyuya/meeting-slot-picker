import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { setRefreshToken } from "../lib/secrets";

describe("App (Pro 版: 複数 provider 対応)", () => {
  it("両方未連携時は ConnectPrompt を表示 (Google と Outlook の両ボタン)", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /カレンダーと連携/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google と連携する" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Outlook と連携する" })).toBeInTheDocument();
  });

  it("Google だけでも連携済みなら週グリッドを表示し、設定を開閉できる", async () => {
    await setRefreshToken("google", "rt");
    render(<App />);
    await screen.findByText("日程ピッカー Pro");
    await waitFor(() => expect(screen.getByText("9:00")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "設定" }));
    expect(await screen.findByRole("button", { name: "保存" })).toBeInTheDocument();
    // SubscriptionBadge が出ている
    expect(screen.getByText(/Free Pro Beta/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(screen.getByText("9:00")).toBeInTheDocument());
  });

  it("ヘッダに既定ショートカットを Ctrl+Shift+U 形式で表示する", async () => {
    render(<App />);
    await screen.findByText("日程ピッカー Pro");
    expect(screen.getByText("Ctrl+Shift+U")).toBeInTheDocument();
  });

  it("枠を選択するとプレビューに反映されコピーできる", async () => {
    await setRefreshToken("google", "rt");
    render(<App />);
    await waitFor(() => expect(screen.getByText("9:00")).toBeInTheDocument());

    const cells = screen.getAllByRole("button").filter((b) => b.getAttribute("data-key"));
    await userEvent.click(cells[0]);
    const copyBtn = await screen.findByRole("button", { name: /コピー（1枠）/ });
    await userEvent.click(copyBtn);
    expect(await screen.findByText(/コピーしました/)).toBeInTheDocument();
  });
});
