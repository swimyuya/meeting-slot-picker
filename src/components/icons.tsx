/**
 * インライン SVG アイコンセット (外部アイコン依存なし・currentColor 継承)。
 * stroke 系は 1.5px / 24 viewBox。size は表示ピクセル。
 */

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({
  size = 14,
  className,
  children,
  filled = false,
}: IconProps & { children: React.ReactNode; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** アプリのロゴマーク: ブランドグラデの角丸タイルに白いカレンダー+チェック。 */
export function LogoMark({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="url(#logo-g)" />
      <rect x="5.5" y="7" width="13" height="11" rx="2" fill="none" stroke="#fff" strokeWidth="1.7" />
      <path d="M5.5 10.5h13" stroke="#fff" strokeWidth="1.4" />
      <path d="M8.5 5v3M15.5 5v3" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9.3 14.4l1.9 1.9 3.5-3.5" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12.5l5.5 5.5L20 6.5" />
    </Svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 11a8 8 0 1 0-1.2 5.2" />
      <path d="M20 5v6h-6" />
    </Svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function IconGear(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.5-2-3.5-2.4.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4a7.6 7.6 0 0 0-2.6 1.5l-2.4-.9-2 3.5 2 1.5a7.7 7.7 0 0 0 0 3l-2 1.5 2 3.5 2.4-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 2.6-1.5l2.4.9 2-3.5z" />
    </Svg>
  );
}

export function IconUnlink(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 15l6-6" />
      <path d="M11 6.5l1.5-1.5a4 4 0 0 1 5.7 5.7L16.5 12" />
      <path d="M13 17.5L11.5 19a4 4 0 0 1-5.7-5.7L7.5 12" />
      <path d="M4 4l2 2M18 18l2 2" />
    </Svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.5 6L8.5 12l6 6" />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.5 6l6 6-6 6" />
    </Svg>
  );
}

/* ---- provider グリフ (商標ロゴの複製ではなく簡易表現) ---- */

/** Google: ブランド4色のセグメントリング + G。 */
export function GoogleGlyph({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" fill="#4285F4" />
      <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" />
      <path d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9l3.3-2.5z" fill="#FBBC05" />
      <path d="M12 6c1.5 0 2.8.5 3.8 1.5L18.7 4A10 10 0 0 0 3.1 7.5L6.4 10c.8-2.3 3-4 5.6-4z" fill="#EA4335" />
    </svg>
  );
}

/** Microsoft: 4色スクエア。 */
export function MicrosoftGlyph({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="2" width="9.5" height="9.5" fill="#F25022" />
      <rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00" />
      <rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900" />
    </svg>
  );
}

/** Apple: シンプルなりんごシルエット (currentColor)。 */
export function AppleGlyph({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.7 12.9c0-2 1.6-3 1.7-3.1-.9-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2 1 0 1.4-.6 2.6-.6 1.2 0 1.5.6 2.6.6 1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.1-.8-2.1-3z" />
      <path d="M14.6 6.1c.5-.7.9-1.6.8-2.6-.8 0-1.7.5-2.3 1.2-.5.6-1 1.5-.8 2.5.9 0 1.8-.4 2.3-1.1z" />
    </svg>
  );
}
