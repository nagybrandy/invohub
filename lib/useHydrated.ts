// lib/useHydrated.ts
// false on the server and during the hydration render, true from the first
// client render after it. Anything that picks markup from the viewport
// (useWindowDimensions reports width 0 on the server) must wait for this,
// or the server's HTML and the client's first render disagree and React
// throws away the pre-rendered page (error #418).
import * as React from "react";

const subscribe = () => () => {};

export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
