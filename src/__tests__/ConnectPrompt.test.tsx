import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConnectPrompt } from "../components/ConnectPrompt";

describe("ConnectPrompt", () => {
  it("連携ボタンで onConnect を呼ぶ", async () => {
    const onConnect = vi.fn();
    render(<ConnectPrompt onConnect={onConnect} busy={false} error={null} clientIdMissing={false} />);
    await userEvent.click(screen.getByRole("button", { name: /連携する/ }));
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it("clientId 未設定時はボタン無効＋警告を出す", () => {
    render(<ConnectPrompt onConnect={vi.fn()} busy={false} error={null} clientIdMissing={true} />);
    expect(screen.getByRole("button", { name: /連携する/ })).toBeDisabled();
    expect(screen.getByText(/VITE_GOOGLE_CLIENT_ID/)).toBeInTheDocument();
  });
});
