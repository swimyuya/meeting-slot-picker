import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConnectPrompt } from "../components/ConnectPrompt";

const noErrors = {};
const allConfigured = { google: false, microsoft: false };

describe("ConnectPrompt (Pro 版: Google + Outlook 両ボタン)", () => {
  it("Google ボタンで provider=google が渡る", async () => {
    const onConnect = vi.fn();
    render(
      <ConnectPrompt
        onConnect={onConnect}
        busy={null}
        errors={noErrors}
        configMissing={allConfigured}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Google と連携する" }));
    expect(onConnect).toHaveBeenCalledWith("google");
  });

  it("Outlook ボタンで provider=microsoft が渡る", async () => {
    const onConnect = vi.fn();
    render(
      <ConnectPrompt
        onConnect={onConnect}
        busy={null}
        errors={noErrors}
        configMissing={allConfigured}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Outlook と連携する" }));
    expect(onConnect).toHaveBeenCalledWith("microsoft");
  });

  it("configMissing.google=true でボタン無効＋警告", () => {
    render(
      <ConnectPrompt
        onConnect={vi.fn()}
        busy={null}
        errors={noErrors}
        configMissing={{ google: true, microsoft: false }}
      />,
    );
    expect(screen.getByRole("button", { name: "Google と連携する" })).toBeDisabled();
    expect(screen.getByText(/VITE_GOOGLE_CLIENT_ID/)).toBeInTheDocument();
  });

  it("busy=microsoft のとき Outlook ボタンに「連携中…」が表示される", () => {
    render(
      <ConnectPrompt
        onConnect={vi.fn()}
        busy="microsoft"
        errors={noErrors}
        configMissing={allConfigured}
      />,
    );
    expect(screen.getByRole("button", { name: "連携中…" })).toBeInTheDocument();
  });
});
