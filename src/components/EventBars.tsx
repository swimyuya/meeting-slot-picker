import { barGeometry, type TimedEventLayout } from "../domain/dayLayout";
import {
  DEFAULT_EVENT_SOURCE,
  eventBarColorClasses,
  eventSourcePrefix,
} from "../lib/provider-ui";
import { toHHMM } from "../lib/time";

/**
 * week (PC 週グリッド) と day (モバイル 1 日ビュー) の意図的な見た目差分。
 * ジオメトリは共通で、余白 / フォント / 時刻ラベルを出す高さ閾値だけが違う。
 */
const VARIANTS = {
  week: {
    barTextClass: "text-[10px]",
    timeTextClass: "text-[9px]",
    labelMinHeightPx: 24,
    laneInsetPx: 1,
  },
  day: {
    barTextClass: "text-[11px]",
    timeTextClass: "text-[10px]",
    labelMinHeightPx: 26,
    laneInsetPx: 2,
  },
} as const;

interface Props {
  layouts: readonly TimedEventLayout[];
  gridStartMs: number;
  timeAreaHeight: number;
  variant: keyof typeof VARIANTS;
}

/**
 * 時刻予定バーの絶対配置レイヤー (pointer-events: none)。
 * 相対配置の時間エリア (WeekGrid の日付列 / MobileDayView の 1 日カラム) 内に置く。
 * source で薄く色分け: Google=グレー, Outlook=水色, Apple=ピンク。
 */
export function EventBars({ layouts, gridStartMs, timeAreaHeight, variant }: Props) {
  const v = VARIANTS[variant];
  return (
    <>
      {layouts.map((layout) => {
        const { topPx, heightPx, leftPct, widthPct } = barGeometry(
          layout,
          gridStartMs,
          timeAreaHeight,
        );
        const startStr = toHHMM(new Date(layout.event.start));
        const endStr = toHHMM(new Date(layout.event.end));
        const prefix = eventSourcePrefix(layout.event.source);
        const titleText = `${startStr}-${endStr} ${prefix}${layout.event.summary}`;
        return (
          <div
            key={layout.event.id}
            data-event-id={layout.event.id}
            data-event-source={layout.event.source ?? DEFAULT_EVENT_SOURCE}
            title={titleText}
            className={`pointer-events-none absolute z-10 overflow-hidden rounded-md border-l-2 px-1.5 ${v.barTextClass} leading-tight ${eventBarColorClasses(layout.event.source)}`}
            style={{
              top: topPx,
              height: heightPx,
              left: `calc(${leftPct}% + ${v.laneInsetPx}px)`,
              width: `calc(${widthPct}% - ${v.laneInsetPx * 2}px)`,
            }}
          >
            <div className="truncate font-medium">{layout.event.summary}</div>
            {heightPx >= v.labelMinHeightPx && (
              <div className={`truncate ${v.timeTextClass} tabular-nums opacity-70`}>
                {startStr}-{endStr}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
