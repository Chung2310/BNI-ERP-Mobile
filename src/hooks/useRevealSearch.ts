import { useCallback, useEffect, useRef } from "react";
import { Keyboard, type LayoutChangeEvent, type ScrollView } from "react-native";
import { spacing } from "@/theme/tokens";

export function useRevealSearch() {
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const focusedRef = useRef(false);

  const reveal = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(0, offsetRef.current - spacing.lg), animated: true });
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      if (focusedRef.current) requestAnimationFrame(reveal);
    });
    return () => show.remove();
  }, [reveal]);

  return {
    scrollRef,
    onSearchLayout: (event: LayoutChangeEvent) => { offsetRef.current = event.nativeEvent.layout.y; },
    onSearchFocus: () => { focusedRef.current = true; requestAnimationFrame(reveal); },
    onSearchBlur: () => { focusedRef.current = false; },
  };
}
