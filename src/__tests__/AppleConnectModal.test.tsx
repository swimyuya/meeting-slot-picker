/**
 * AppleConnectModal の入力 UI の検証。
 */

import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppleConnectModal } from "../components/AppleConnectModal";

describe("AppleConnectModal", () => {
  it("初期状態では「連携する」ボタンが disabled", () => {
    render(<AppleConnectModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByRole("button", { name: "連携する" })).toBeDisabled();
  });

  it("キャンセルで onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    render(<AppleConnectModal onClose={onClose} onSuccess={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("パスワード「表示」ボタンで type=text に切り替わる", async () => {
    render(<AppleConnectModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    const pw = screen.getByPlaceholderText("xxxxxxxxxxxxxxxx") as HTMLInputElement;
    expect(pw.type).toBe("password");
    await userEvent.click(screen.getByRole("button", { name: "表示" }));
    expect(pw.type).toBe("text");
  });

  it("ペースト時のハイフンは自動除去される", () => {
    render(<AppleConnectModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    const pw = screen.getByPlaceholderText("xxxxxxxxxxxxxxxx") as HTMLInputElement;
    fireEvent.change(pw, { target: { value: "abcd-efgh-ijkl-mnop" } });
    expect(pw.value).toBe("abcdefghijklmnop");
  });

  it("メールとパスワードが入ると「連携する」が有効化される", async () => {
    render(<AppleConnectModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    const email = screen.getByPlaceholderText("you@icloud.com") as HTMLInputElement;
    const pw = screen.getByPlaceholderText("xxxxxxxxxxxxxxxx") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "u@example.com" } });
    fireEvent.change(pw, { target: { value: "abcdefghijklmnop" } });
    expect(screen.getByRole("button", { name: "連携する" })).toBeEnabled();
  });
});
