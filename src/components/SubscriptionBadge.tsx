/**
 * 将来のサブスク状態表示用バナー。
 * 現状 Pro Beta 中は「Free Pro Beta — 全機能ご利用いただけます」を出すだけ。
 * 後で license 検証ロジックを足したときは props で trial 残日数 / Pro 加入 / 期限切れ を切替表示。
 */

export interface SubscriptionBadgeProps {
  /** "beta": Free Pro Beta / "trial": Pro Trial N日 / "active": Pro 加入中 / "expired": 期限切れ */
  status?: "beta" | "trial" | "active" | "expired";
  /** trial 残日数 (status="trial" のとき表示) */
  daysRemaining?: number;
}

const BASE =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1";

export function SubscriptionBadge({ status = "beta", daysRemaining }: SubscriptionBadgeProps) {
  switch (status) {
    case "trial":
      return (
        <span className={`${BASE} bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30`}>
          ⏳ Pro 無料試用中{daysRemaining != null ? `（あと ${daysRemaining} 日）` : ""}
        </span>
      );
    case "active":
      return (
        <span className={`${BASE} bg-emerald-50 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30`}>
          ✓ Pro 加入中
        </span>
      );
    case "expired":
      return (
        <span className={`${BASE} bg-red-50 text-red-800 ring-red-200/70 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30`}>
          ⚠️ Pro 試用期間が終了しました
        </span>
      );
    case "beta":
    default:
      return (
        <span className={`${BASE} bg-gradient-to-r from-brand-50 to-violet-50 text-brand-800 ring-brand-200/70 dark:from-brand-500/10 dark:to-violet-500/10 dark:text-brand-300 dark:ring-brand-500/30`}>
          🎁 Free Pro Beta — 全機能ご利用いただけます
        </span>
      );
  }
}
