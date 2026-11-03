// components/ui/menu/use-menu-keyboard.ts
// Keyboard model for popover menus on web (create menu, account menu, row
// menus): focus lands on the first item when the menu opens, ArrowUp/Down
// move between items (wrapping), Home/End jump, and Tab stays a normal Tab.
// The rows are the elements with role="menuitem" inside the menu container,
// so it works for any markup. Native has no hardware focus: every function is
// a no-op there.
import * as React from "react";
import { Platform } from "react-native";

type FocusableNode = {
  querySelectorAll?: (selector: string) => ArrayLike<{ focus?: () => void }>;
  ownerDocument?: { activeElement?: unknown };
};

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"]):not([disabled])';

export function menuItems(container: FocusableNode | null | undefined): Array<{ focus?: () => void }> {
  if (!container || typeof container.querySelectorAll !== "function") return [];
  return Array.from(container.querySelectorAll(ITEM_SELECTOR));
}

/** Index to focus after `key`, or null when the key is not a menu navigation key. */
export function nextMenuIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
      return current < 0 ? 0 : (current + 1) % count;
    case "ArrowUp":
      return current < 0 ? count - 1 : (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

type KeyEvent = { key?: string; nativeEvent?: { key?: string }; preventDefault?: () => void; currentTarget?: unknown };

export function useMenuKeyboard({ autoFocus = true }: { autoFocus?: boolean } = {}) {
  const ref = React.useRef<FocusableNode | null>(null);

  React.useEffect(() => {
    if (!autoFocus || Platform.OS !== "web") return;
    // Wait a tick: the portal content is mounted after the effect that opened it.
    const timer = setTimeout(() => menuItems(ref.current)[0]?.focus?.(), 0);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  const onKeyDown = React.useCallback((event: KeyEvent) => {
    if (Platform.OS !== "web") return;
    const key = event.key ?? event.nativeEvent?.key ?? "";
    const container = (event.currentTarget as FocusableNode | undefined) ?? ref.current;
    const items = menuItems(container);
    const active = container?.ownerDocument?.activeElement;
    const next = nextMenuIndex(key, items.indexOf(active as never), items.length);
    if (next == null) return;
    event.preventDefault?.();
    items[next]?.focus?.();
  }, []);

  return { ref, onKeyDown };
}
