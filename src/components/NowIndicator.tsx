import { SLOT_DURATION_MS, SLOT_HEIGHT_PX } from "../domain/dayLayout";

/**
 * 現在時刻ライン。今日の時間エリア (relative) 内に絶対配置で重ねる。
 * 表示範囲外 (グリッドの上下にはみ出す時刻) では何も描かない。
 */
export function NowIndicator({
  now,
  gridStartMs,
  timeAreaHeight,
}: {
  now: Date;
  gridStartMs: number;
  timeAreaHeight: number;
}) {
  const top = ((now.getTime() - gridStartMs) / SLOT_DURATION_MS) * SLOT_HEIGHT_PX;
  if (top < 0 || top > timeAreaHeight) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20"
      style={{ top }}
      aria-hidden="true"
      data-now-indicator
    >
      <div className="relative h-px bg-red-500/80">
        <span className="absolute -left-[3px] -top-[3px] h-[7px] w-[7px] rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-950" />
      </div>
    </div>
  );
}
