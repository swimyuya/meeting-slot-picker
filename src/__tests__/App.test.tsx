import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { setRefreshToken } from "../lib/secrets";

beforeEach(() => localStorage.clear());

describe("App", () => {
  it("未連携時は連携案内を表示する", async () => {
    render(<App />);
    expect(await screen.findByText("Google カレンダーと連携")).toBeInTheDocument();
  });

  it("連携済みなら週グリッドを表示し、設定を開閉できる", async () => {
    await setRefreshToken("rt");
    render(<App />);
    await screen.findByText("日程ピッカー");
    await waitFor(() => expect(screen.getByText("9:00")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "設定" }));
    expect(await screen.findByRole("button", { name: "保存" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(screen.getByText("9:00")).toBeInTheDocument());
  });

  it("枠を選択するとプレビューに反映されコピーできる", async () => {
    await setRefreshToken("rt");
    render(<App />);
    await waitFor(() => expect(screen.getByText("9:00")).toBeInTheDocument());

    const cells = screen.getAllByRole("button").filter((b) => b.getAttribute("data-key"));
    await userEvent.click(cells[0]);
    const copyBtn = await screen.findByRole("button", { name: /コピー（1枠）/ });
    await userEvent.click(copyBtn);
    expect(await screen.findByText(/コピーしました/)).toBeInTheDocument();

    // クリアで選択解除 → クリアボタンが無効化される
    await userEvent.click(screen.getByRole("button", { name: "クリア" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "クリア" })).toBeDisabled());
  });
});
