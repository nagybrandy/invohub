// lib/ui/confirm.web.ts
// Web implementation of the cross-platform confirm() helper — see
// lib/ui/confirm.ts. react-native-web's Alert.alert is a true no-op
// (node_modules/react-native-web/dist/exports/Alert/index.js), so
// destructive actions on web must go through this instead.
import type { ConfirmOptions } from "@/lib/ui/confirm";

export type { ConfirmOptions } from "@/lib/ui/confirm";

export async function confirmAsync(options: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return false;
  }
  const text = options.message ? `${options.title}\n\n${options.message}` : options.title;
  return window.confirm(text);
}
