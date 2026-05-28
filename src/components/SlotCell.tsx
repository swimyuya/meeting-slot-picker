import { useRef } from "react";
import type { CalendarEvent } from "../calendar/types";
import type { Slot } from "../domain/slots";
import { toHHMM, toJstParts } from "../lib/time";

interface Props {
  slot: Slot;
  selected: boolean;
  onDown: (key: string, isSelected: boolean) => void;
  onEnter: (key: string) => void;
}

// タッチで「タップか / スクロール・スワイプか」を判定する移動量しきい値 (px)
const TAP_TOLERANCE_PX = 10;

/**
 * 30分枠1セル (選択ターゲット)。予定の表示は WeekGrid 側でバーとして重ねるため、
 * このセルは選択状態の表現と、タッチ/クリックの受け口に専念する。
 *
 * タッチ操作の意図分離:
 *   - touch-action: pan-y を CSS で指定 → 縦スクロールはブラウザに任せる
 *   - pointerdown 時点では何もしない (スワイプ/スクロールの可能性があるため)
 *   - pointermove で移動量がしきい値を超えたらタップキャンセル
 *   - pointerup でキャンセルされていなければ選択を発火
 * これにより上下スクロール・横スワイプ (日付遷移) で誤選択しなくなる。
 *
 * マウスは従来どおり pointerdown で即時選択し、pointerenter でドラッグ選択も継続。
 */
export function SlotCell({ slot, selected, onDown, onEnter }: Props) {
  const baseClasses = "h-7 cursor-pointer border-b border-gray-100 transition-colors";
  const bgClass = selected ? "bg-brand/80" : "bg-white hover:bg-brand/15";
  const hasEvents = slot.events.length > 0;
  const ariaLabel = hasEvents
    ? slot.events.map((e) => e.summary).join(", ")
    : slot.busy
      ? "予定あり"
      : selected
        ? "選択中"
        : "空き";
  const tooltipText = hasEvents
    ? `${slot.events.map(formatEventLine).join("\n")}\n(クリックで選択)`
    : slot.busy
      ? "予定あり（クリックで選択）"
      : selected
        ? "選択中（クリックで解除）"
        : "クリックで選択";

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const tapCancelledRef = useRef(false);

  return (
    <div
      role="button"
      aria-pressed={selected}
      data-key={slot.key}
      aria-label={ariaLabel}
      title={tooltipText}
      className={`${baseClasses} ${bgClass}`}
      // pan-y で縦スクロール、pinch-zoom で 2 本指拡大縮小をブラウザに任せる。
      // 横方向の pan は JS の useHorizontalSwipe が扱う (browser に渡さない)。
      style={{ touchAction: "pan-y pinch-zoom" }}
      onPointerDown={(e) => {
        if (!isTouchLike(e.pointerType)) {
          // デスクトップ (mouse / 未指定): 即時選択 (+ pointerenter でドラッグ選択)
          e.preventDefault();
          onDown(slot.key, selected);
          return;
        }
        // touch / pen: 開始位置を記録、判定は pointerup まで保留
        touchStartRef.current = { x: e.clientX, y: e.clientY };
        tapCancelledRef.current = false;
      }}
      onPointerMove={(e) => {
        if (!isTouchLike(e.pointerType)) return;
        const start = touchStartRef.current;
        if (!start || tapCancelledRef.current) return;
        const dx = Math.abs(e.clientX - start.x);
        const dy = Math.abs(e.clientY - start.y);
        if (dx > TAP_TOLERANCE_PX || dy > TAP_TOLERANCE_PX) {
          tapCancelledRef.current = true;
        }
      }}
      onPointerUp={(e) => {
        if (!isTouchLike(e.pointerType)) return;
        const wasTap = touchStartRef.current !== null && !tapCancelledRef.current;
        touchStartRef.current = null;
        if (wasTap) onDown(slot.key, selected);
      }}
      onPointerCancel={() => {
        touchStartRef.current = null;
        tapCancelledRef.current = true;
      }}
      onPointerEnter={(e) => {
        // ドラッグ選択はマウスのみ。touch は pointer capture で他 cell へ enter しない。
        if (isTouchLike(e.pointerType)) return;
        onEnter(slot.key);
      }}
    />
  );
}

/** タッチ系入力か。空文字 (テスト合成イベント等) はマウス扱いとして既存挙動を保つ。 */
function isTouchLike(pointerType: string): boolean {
  return pointerType === "touch" || pointerType === "pen";
}

function formatEventLine(ev: CalendarEvent): string {
  const prefix =
    ev.source === "microsoft"
      ? "Outlook: "
      : ev.source === "apple"
        ? "Apple: "
        : "";
  if (ev.allDay) return `終日 ${prefix}${ev.summary}`;
  const startD = new Date(ev.start);
  const endD = new Date(ev.end);
  const sP = toJstParts(startD);
  const eP = toJstParts(endD);
  const sameDay = sP.year === eP.year && sP.month === eP.month && sP.day === eP.day;
  if (sameDay) return `${toHHMM(startD)}-${toHHMM(endD)} ${prefix}${ev.summary}`;
  return `${sP.month}/${sP.day} ${toHHMM(startD)} - ${eP.month}/${eP.day} ${toHHMM(endD)} ${prefix}${ev.summary}`;
}
