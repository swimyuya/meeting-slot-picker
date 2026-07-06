import { PROVIDER_IDS, type ProviderId } from "../auth/providers";
import { providerShortLabel } from "../lib/provider-ui";
import { AppleGlyph, GoogleGlyph, MicrosoftGlyph } from "./icons";

/**
 * ヘッダ右側の provider 接続インジケータ。
 * 接続済み = カラー表示 / 未連携 = グレーアウト。tooltip で状態を示す。
 */
export function ProviderDots({ connected }: { connected: Record<ProviderId, boolean | null> }) {
  return (
    <span className="flex items-center gap-1.5" aria-label="カレンダー接続状態">
      {PROVIDER_IDS.map((p) => {
        const isOn = connected[p] === true;
        return (
          <span
            key={p}
            title={`${providerShortLabel(p)}: ${isOn ? "接続済み" : "未連携"}`}
            className={`transition-all duration-300 ${
              isOn ? "opacity-100" : "opacity-25 grayscale"
            }`}
          >
            {p === "google" && <GoogleGlyph size={12} />}
            {p === "microsoft" && <MicrosoftGlyph size={11} />}
            {p === "apple" && (
              <AppleGlyph size={13} className="text-gray-800 dark:text-zinc-200" />
            )}
          </span>
        );
      })}
    </span>
  );
}
