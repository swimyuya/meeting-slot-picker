import type { CalendarEvent } from "../calendar/types";
import type { Slot } from "../domain/slots";
import { toHHMM, toJstParts } from "../lib/time";

interface Props {
  slot: Slot;
  selected: boolean;
  onDown: (key: string, isSelected: boolean) => void;
  onEnter: (key: string) => void;
}

/**
 * 30分枠1セル (選択ターゲット)。予定の表示は WeekGrid 側でバーとして重ねるため、
 * このセルは選択状態の表現と、タッチ/クリックの受け口に専念する。
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
  return (
    <div
      role="button"
      aria-pressed={selected}
      data-key={slot.key}
      aria-label={ariaLabel}
      title={tooltipText}
      className={`${baseClasses} ${bgClass}`}
      onPointerDown={(e) => {
        e.preventDefault();
        onDown(slot.key, selected);
      }}
      onPointerEnter={() => onEnter(slot.key)}
    />
  );
}

function formatEventLine(ev: CalendarEvent): string {
  if (ev.allDay) return `終日 ${ev.summary}`;
  const startD = new Date(ev.start);
  const endD = new Date(ev.end);
  const sP = toJstParts(startD);
  const eP = toJstParts(endD);
  const sameDay = sP.year === eP.year && sP.month === eP.month && sP.day === eP.day;
  if (sameDay) return `${toHHMM(startD)}-${toHHMM(endD)} ${ev.summary}`;
  return `${sP.month}/${sP.day} ${toHHMM(startD)} - ${eP.month}/${eP.day} ${toHHMM(endD)} ${ev.summary}`;
}
