// components/layout/OverflowMenu.web.tsx
// Web variant of the "⋯" popover: every Box/View gets `position: relative;
// z-index: 0` from the shared NativeWind reset, so each table ROW becomes
// its own stacking context — an absolutely-positioned dropdown nested
// inside one row can never paint (or receive clicks) above a LATER
// sibling row, no matter its own z-index. The visual result looked right
// (the dropdown appears to render on top), but clicks silently landed on
// whatever cell of the row underneath happened to be at that pixel —
// e.g. opening a partner row's menu and clicking "Számla ennek a
// partnernek" could navigate to a different row's edit screen instead.
// A portal to `document.body`, positioned via the trigger's own
// getBoundingClientRect(), escapes every ancestor's stacking context so
// clicks always land on the menu that is actually visible.
//
// Redesign 2026-11: tokens.md §6.14 look, ArrowUp/Down/Home/End between the
// rows, focus on the first row when it opens, Esc closes and returns focus to
// the trigger, at most five rows (warns in development).
import * as React from "react";
import { MoreVertical } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { webDomProps } from "@/components/ui/web-dom-props";
import { useMenuKeyboard } from "@/components/ui/menu/use-menu-keyboard";
import { useIconColors } from "@/lib/theme/icon-colors";
import {
  MENU_ITEM_CLASS,
  MENU_TRIGGER_CLASS,
  warnIfTooManyItems,
  type OverflowMenuItem,
} from "@/components/layout/menu-shared";

// No @types/react-dom in this project — cast the import instead of adding a
// new type dependency for one function.
const { createPortal } = require("react-dom") as {
  createPortal: (children: React.ReactNode, container: Element) => React.ReactPortal;
};

export type { OverflowMenuItem };
export { MAX_MENU_ITEMS } from "@/components/layout/menu-shared";

type OverflowMenuProps = {
  items: OverflowMenuItem[];
  label?: string;
  align?: "left" | "right";
};

const MENU_MIN_WIDTH = 230;

function MenuPanel({
  position,
  items,
  close,
  icons,
}: {
  position: { top: number; left: number };
  items: OverflowMenuItem[];
  close: () => void;
  icons: ReturnType<typeof useIconColors>;
}) {
  const keyboard = useMenuKeyboard();
  return (
    <div
      ref={keyboard.ref as React.Ref<HTMLDivElement>}
      onKeyDown={keyboard.onKeyDown as unknown as React.KeyboardEventHandler<HTMLDivElement>}
      {...webDomProps({
        role: "menu",
        "data-testid": "overflow-menu-content",
        className:
          "flex flex-col gap-0.5 rounded-menu border border-line-strong bg-surface p-1.5 shadow-menu",
      })}
      // Set directly, never through webDomProps: that helper strips
      // `style` (RN style arrays must not reach the DOM), and without
      // these the portal div renders in normal flow at the end of
      // <body> — open, full-width, below the fold, "not working".
      style={{
        position: "fixed",
        top: position.top,
        left: Math.max(8, position.left),
        zIndex: 1000,
        minWidth: MENU_MIN_WIDTH,
      }}
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <Pressable
            key={`${item.label}-${index}`}
            testID={`overflow-menu-item-${index}`}
            disabled={item.disabled}
            accessibilityRole="menuitem"
            onPress={() => {
              close();
              item.onPress();
            }}
            className={`${MENU_ITEM_CLASS} ${item.disabled ? "opacity-40" : ""}`}
          >
            {Icon ? <Icon size={18} color={item.destructive ? icons.destructive : icons.muted} /> : null}
            <Text size="sm" className={`font-medium ${item.destructive ? "text-err" : "text-ink"}`}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </div>
  );
}

export function OverflowMenu({ items, label = "More actions", align = "right" }: OverflowMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const icons = useIconColors();

  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      // A press inside the menu panel is handled by its own items.
      if ((target as HTMLElement).closest?.('[data-testid="overflow-menu-content"]')) return;
      close();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus?.();
      }
    }
    function handleReposition() {
      close();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open, close]);

  warnIfTooManyItems(items.length);
  if (items.length === 0) return null;

  function handleTriggerPress() {
    const rect =
      typeof triggerRef.current?.getBoundingClientRect === "function"
        ? triggerRef.current.getBoundingClientRect()
        : null;
    setPosition({
      top: (rect?.bottom ?? 0) + 4,
      left: align === "right" ? (rect?.right ?? 0) - MENU_MIN_WIDTH : (rect?.left ?? 0),
    });
    setOpen((v) => !v);
  }

  return (
    <Box className="relative">
      <Pressable
        testID="overflow-menu-trigger"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={handleTriggerPress}
        hitSlop={8}
        className={MENU_TRIGGER_CLASS}
        // @ts-expect-error — RN Pressable doesn't type a DOM ref, but on web
        // this forwards to the real <button>/<div> node we need for
        // getBoundingClientRect().
        ref={triggerRef}
      >
        <MoreVertical size={18} color={icons.muted} />
      </Pressable>
      {open && position
        ? createPortal(
            <MenuPanel position={position} items={items} close={close} icons={icons} />,
            document.body,
          )
        : null}
    </Box>
  );
}
