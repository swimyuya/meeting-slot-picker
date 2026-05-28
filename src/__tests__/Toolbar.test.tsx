import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toolbar } from "../components/Toolbar";

function setup(overrides: Partial<React.ComponentProps<typeof Toolbar>> = {}) {
  const props = {
    preview: "5/23（水）10:00-11:00",
    count: 2,
    loading: false,
    error: null,
    onCopy: vi.fn().mockResolvedValue(undefined),
    onClear: vi.fn(),
    onReload: vi.fn(),
    onSettings: vi.fn(),
    onDisconnect: vi.fn(),
    ...overrides,
  };
  render(<Toolbar {...props} />);
  return props;
}

describe("Toolbar", () => {
  it("プレビューと枠数を表示する", () => {
    setup();
    expect(screen.getByLabelText("コピー内容プレビュー")).toHaveValue("5/23（水）10:00-11:00");
    expect(screen.getByRole("button", { name: /コピー（2枠）/ })).toBeInTheDocument();
  });

  it("コピー押下で onCopy を呼び、完了表示する", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /コピー/ }));
    expect(props.onCopy).toHaveBeenCalledOnce();
    expect(await screen.findByText(/コピーしました/)).toBeInTheDocument();
  });

  it("count=0 ではコピー・クリアを無効化する", () => {
    setup({ count: 0 });
    expect(screen.getByRole("button", { name: /コピー/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "クリア" })).toBeDisabled();
  });

  it("コピー失敗時はエラーメッセージを表示する", async () => {
    setup({ onCopy: vi.fn().mockRejectedValue(new Error("clipboard denied")) });
    await userEvent.click(screen.getByRole("button", { name: /コピー/ }));
    expect(await screen.findByText(/コピーに失敗しました/)).toBeInTheDocument();
  });
});
