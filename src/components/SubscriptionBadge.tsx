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

export function SubscriptionBadge({ status = "beta", daysRemaining }: SubscriptionBadgeProps) {
  switch (status) {
    case "trial":
      return (
        <div className="flex items-center justify-center gap-2 rounded bg-amber-100 px-3 py-1.5 text-[11px] text-amber-800">
          <span>⏳ Pro 無料試用中{daysRemaining != null ? `（あと ${daysRemaining} 日）` : ""}</span>
        </div>
      );
    case "active":
      return (
        <div className="flex items-center justify-center gap-2 rounded bg-emerald-100 px-3 py-1.5 text-[11px] text-emerald-800">
          <span>✓ Pro 加入中</span>
        </div>
      );
    case "expired":
      return (
        <div className="flex items-center justify-center gap-2 rounded bg-red-100 px-3 py-1.5 text-[11px] text-red-800">
          <span>⚠️ Pro 試用期間が終了しました</span>
        </div>
      );
    case "beta":
    default:
      return (
        <div className="flex items-center justify-center gap-2 rounded bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-800">
          <span>🎁 Free Pro Beta — 全機能ご利用いただけます</span>
        </div>
      );
  }
}
