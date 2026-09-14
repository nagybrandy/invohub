// components/layout/OverflowMenu.web.tsx
// Web variant: closes on outside click / Escape, via a plain DOM wrapper
// (webDomProps before spreading rest props — AGENTS.md §2).
import { useEffect, useRef, useState } from "react";
import { webDomProps } from "@/components/ui/web-dom-props";
import {
  OverflowMenuList,
  OverflowMenuTrigger,
  type OverflowMenuProps,
} from "@/components/layout/OverflowMenu";

export type { OverflowMenuItem, OverflowMenuProps } from "@/components/layout/OverflowMenu";

export function OverflowMenu({ items, trigger, open: openProp, onOpenChange, ...rest }: OverflowMenuProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setOpen]);

  return (
    <div
      data-testid="overflow-menu"
      ref={rootRef}
      className="relative"
      {...webDomProps(rest)}
    >
      <OverflowMenuTrigger onPress={() => setOpen(!open)} trigger={trigger} />
      {open ? (
        <OverflowMenuList
          items={items}
          onItemPress={(item) => {
            setOpen(false);
            item.onPress();
          }}
        />
      ) : null}
    </div>
  );
}
