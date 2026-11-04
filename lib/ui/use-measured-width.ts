// lib/ui/use-measured-width.ts
// React Native has no container queries. Lists, settings panes and the
// invoice-customisation preview decide their layout from their OWN width
// (SPEC §3): spread `onLayout` on the container and read `width`.
// `width` is 0 until the first layout, so callers pick a mobile-first default
// while it is 0 (or check `measured`).
import * as React from "react";
import type { LayoutChangeEvent } from "react-native";

export function useMeasuredWidth(): {
  width: number;
  measured: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
} {
  const [width, setWidth] = React.useState(0);
  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  }, []);
  return { width, measured: width > 0, onLayout };
}
