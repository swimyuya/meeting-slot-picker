import { describe, expect, it } from "vitest";
import { format, type FormattableSlot } from "../domain/formatter";
import { fromJst } from "../lib/time";

/** 30分枠を作るテストヘルパー (2026-01 固定)。 */
function slot(day: number, hour: number, minute: number): FormattableSlot {
  const start = fromJst(2026, 1, day, hour, minute);
  return {
    dayISO: `2026-01-${String(day).padStart(2, "0")}`,
    start,
    end: new Date(start.getTime() + 30 * 60 * 1000),
  };
}

describe("formatter", () => {
  it("空配列は空文字を返す", () => {
    expect(format([])).toBe("");
  });

  it("単一枠を整形する (2026-01-01 は木曜)", () => {
    expect(format([slot(1, 10, 0)])).toBe("1/1（木）10:00-10:30");
  });

  it("連続する30分枠を1つの範囲に結合する", () => {
    expect(format([slot(1, 10, 0), slot(1, 10, 30)])).toBe("1/1（木）10:00-11:00");
  });

  it("間隔があく枠は ' / ' 区切りの複数範囲にする", () => {
    const out = format([slot(1, 10, 0), slot(1, 10, 30), slot(1, 13, 0)]);
    expect(out).toBe("1/1（木）10:00-11:00 / 13:00-13:30");
  });

  it("複数日は日付昇順で改行区切り (入力順に依存しない)", () => {
    const out = format([
      slot(2, 14, 0),
      slot(2, 14, 30),
      slot(2, 15, 0),
      slot(2, 15, 30),
      slot(1, 10, 0),
      slot(1, 10, 30),
      slot(1, 13, 0),
    ]);
    expect(out).toBe("1/1（木）10:00-11:00 / 13:00-13:30\n1/2（金）14:00-16:00");
  });

  it("テンプレートを差し替えできる", () => {
    expect(format([slot(1, 10, 0)], { template: "{date}({wday}) {ranges}" })).toBe(
      "1/1(木) 10:00-10:30",
    );
  });
});
