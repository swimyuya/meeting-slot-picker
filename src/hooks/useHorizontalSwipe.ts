import { useEffect, useRef, type RefObject } from "react";

interface SwipeOptions {
  /** スワイプと判定する最小水平距離 (px)。 */
  threshold?: number;
  /** 縦方向の許容ぶれ (これ以上縦に動いたら垂直スクロール扱い)。 */
  verticalTolerance?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * 水平スワイプを検出する。pointer events ベース、シンプル実装。
 * - 垂直スクロールが目的の場合は何もしない (verticalTolerance を超えた縦移動を検知して破棄)。
 */
export function useHorizontalSwipe<T extends HTMLElement>(opts: SwipeOptions): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const cancelledRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const threshold = optsRef.current.threshold ?? 50;
    const verticalTolerance = optsRef.current.verticalTolerance ?? 40;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      startRef.current = { x: e.clientX, y: e.clientY };
      cancelledRef.current = false;
    };
    const onMove = (e: PointerEvent) => {
      const start = startRef.current;
      if (!start || cancelledRef.current) return;
      const dy = Math.abs(e.clientY - start.y);
      if (dy > verticalTolerance) cancelledRef.current = true;
    };
    const onUp = (e: PointerEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start || cancelledRef.current) return;
      const dx = e.clientX - start.x;
      if (Math.abs(dx) < threshold) return;
      if (dx > 0) optsRef.current.onSwipeRight?.();
      else optsRef.current.onSwipeLeft?.();
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", () => {
      startRef.current = null;
    });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
  }, []);

  return ref;
}
