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
import * as React from "react";
import { MoreHorizontal } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { webDomProps } from "@/components/ui/web-dom-props";
import { useIconColors } from "@/lib/theme/icon-colors";

// No @types/react-dom in this project — cast the import instead of adding a
// new type dependency for one function.
const { createPortal } = require("react-dom") as {
  createPortal: (children: React.ReactNode, container: Element) => React.ReactPortal;
};
import type { OverflowMenuItem } from "@/components/layout/OverflowMenu";

export type { OverflowMenuItem };

type OverflowMenuProps = {
  items: OverflowMenuItem[];
  label?: string;
  align?: "left" | "right";
};

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
      close();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
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

  if (items.length === 0) return null;

  function handleTriggerPress() {
    const rect =
      typeof triggerRef.current?.getBoundingClientRect === "function"
        ? triggerRef.current.getBoundingClientRect()
        : null;
    setPosition({
      top: (rect?.bottom ?? 0) + 4,
      left: align === "right" ? (rect?.right ?? 0) - 200 : (rect?.left ?? 0),
    });
    setOpen((v) => !v);
  }

  return (
    <Box className="relative">
      <Pressable
        testID="overflow-menu-trigger"
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={handleTriggerPress}
        hitSlop={8}
        className="h-8 w-8 items-center justify-center rounded-lg data-[hover=true]:bg-muted"
        // @ts-expect-error — RN Pressable doesn't type a DOM ref, but on web
        // this forwards to the real <button>/<div> node we need for
        // getBoundingClientRect().
        ref={triggerRef}
      >
        <MoreHorizontal size={18} color={icons.muted} />
      </Pressable>
      {open && position
        ? createPortal(
            <div
              {...webDomProps({
                role: "menu",
                "data-testid": "overflow-menu-content",
                style: {
                  position: "fixed",
                  top: position.top,
                  left: Math.max(8, position.left),
                  zIndex: 1000,
                  minWidth: 200,
                },
                className:
                  "flex flex-col gap-0.5 rounded-lg border border-subtle bg-surface-raised p-1 shadow-sm",
              })}
            >
              {items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Pressable
                    key={`${item.label}-${index}`}
                    testID={`overflow-menu-item-${index}`}
                    disabled={item.disabled}
                    accessibilityRole="button"
                    onPress={() => {
                      close();
                      item.onPress();
                    }}
                    className={`flex-row items-center gap-2 rounded-md px-3 py-2 data-[hover=true]:bg-muted ${
                      item.disabled ? "opacity-40" : ""
                    }`}
                  >
                    {Icon ? (
                      <Icon size={16} color={item.destructive ? icons.destructive : icons.muted} />
                    ) : null}
                    <Text size="sm" className={item.destructive ? "text-destructive" : "text-foreground"}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </Box>
  );
}
