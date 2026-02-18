import { useRef, useEffect } from "react";

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipe(
  ref: React.RefObject<HTMLElement | null>,
  { onSwipeLeft, onSwipeRight, threshold = 50 }: UseSwipeOptions,
) {
  const startX = useRef(0);
  const startY = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;
      // 수평 이동이 수직보다 커야 스와이프로 인식
      if (Math.abs(dx) < threshold || Math.abs(dy) > Math.abs(dx)) return;
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, onSwipeLeft, onSwipeRight, threshold]);
}
