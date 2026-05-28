import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "../components/SettingsPanel";
import { DEFAULT_CONFIG } from "../lib/config";

describe("SettingsPanel", () => {
  it("保存で onSave と onClose を呼ぶ", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={onSave} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("不正値 (endHour <= startHour) ではエラー表示し保存しない", async () => {
    const onSave = vi.fn();
    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={onSave} onClose={vi.fn()} />);
    const endHour = screen.getByLabelText("終了時刻 (時)");
    await userEvent.clear(endHour);
    await userEvent.type(endHour, "9"); // startHour=9 と同値 → 不正
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/endHour/)).toBeInTheDocument();
  });
});
