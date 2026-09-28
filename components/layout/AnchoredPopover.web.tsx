// components/layout/AnchoredPopover.web.tsx
// Web variant: a portal to document.body with position:fixed from the
// anchor's rect — the same escape from row/card stacking contexts the
// OverflowMenu needs (see OverflowMenu.web.tsx). The style is set on the
// div directly, never through webDomProps, which strips `style`.
import * as React from "react";
import { Box } from "@/components/ui/box";
import { webDomProps } from "@/components/ui/web-dom-props";
import type { AnchoredPopoverProps } from "@/components/layout/AnchoredPopover";

const { createPortal } = require("react-dom") as {
  createPortal: (children: React.ReactNode, container: Element) => React.ReactPortal;
};

export type { AnchoredPopoverProps };

const GAP = 6;
const MARGIN = 8;

export function AnchoredPopover({
  open,
  onClose,
  anchor,
  children,
  align = "right",
  width = 360,
  testID = "anchored-popover",
}: AnchoredPopoverProps) {
  const anchorRef = React.useRef<HTMLElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);

  const reposition = React.useCallback(() => {
    const rect =
      typeof anchorRef.current?.getBoundingClientRect === "function"
        ? anchorRef.current.getBoundingClientRect()
        : null;
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : width + MARGIN * 2;
    const rawLeft = align === "right" ? (rect?.right ?? 0) - width : (rect?.left ?? 0);
    setPosition({
      top: (rect?.bottom ?? 0) + GAP,
      left: Math.max(MARGIN, Math.min(rawLeft, viewportWidth - width - MARGIN)),
    });
  }, [align, width]);

  React.useEffect(() => {
    if (!open) return;
    reposition();
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, onClose, reposition]);

  return (
    <>
      {/* @ts-expect-error — on web Box forwards the ref to its DOM node. */}
      <Box ref={anchorRef} className="inline-flex">
        {anchor}
      </Box>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              {...webDomProps({
                role: "dialog",
                "data-testid": testID,
                className: "rounded-xl border border-subtle bg-surface-raised p-4 shadow-md",
              })}
              style={{ position: "fixed", top: position.top, left: position.left, width, zIndex: 1000 }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
