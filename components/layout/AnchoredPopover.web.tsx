// components/layout/AnchoredPopover.web.tsx
// Web variant: a portal to document.body with position:fixed from the
// anchor's rect — the same escape from row/card stacking contexts the
// OverflowMenu needs (see OverflowMenu.web.tsx). The style is set on the
// div directly, never through webDomProps, which strips `style`.
//
// Redesign 2026-11: `placement="above"` for the sidebar account menu,
// `panelClassName`/`role` so menus share this surface (tokens.md §6.14), and
// Escape reports through `onEscape` so the caller can return focus to its
// trigger. Outside press closes; the panel does not trap focus (it is a
// popover, not a modal).
import * as React from "react";
import { Box } from "@/components/ui/box";
import { webDomProps } from "@/components/ui/web-dom-props";
import {
  POPOVER_PANEL_CLASS,
  type AnchoredPopoverProps,
} from "@/components/layout/menu-shared";

const { createPortal } = require("react-dom") as {
  createPortal: (children: React.ReactNode, container: Element) => React.ReactPortal;
};

export type { AnchoredPopoverProps };
export { POPOVER_PANEL_CLASS, MENU_PANEL_CLASS } from "@/components/layout/menu-shared";

const GAP = 6;
const MARGIN = 8;

type Position = { top?: number; bottom?: number; left: number };

export function AnchoredPopover({
  open,
  onClose,
  anchor,
  children,
  align = "right",
  width = 360,
  testID = "anchored-popover",
  placement = "below",
  panelClassName = POPOVER_PANEL_CLASS,
  role = "dialog",
  onEscape,
  anchorClassName = "inline-flex",
}: AnchoredPopoverProps) {
  const anchorRef = React.useRef<HTMLElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState<Position | null>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const onEscapeRef = React.useRef(onEscape);
  onEscapeRef.current = onEscape;

  const reposition = React.useCallback(() => {
    const rect =
      typeof anchorRef.current?.getBoundingClientRect === "function"
        ? anchorRef.current.getBoundingClientRect()
        : null;
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : width + MARGIN * 2;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
    const rawLeft = align === "right" ? (rect?.right ?? 0) - width : (rect?.left ?? 0);
    const left = Math.max(MARGIN, Math.min(rawLeft, viewportWidth - width - MARGIN));
    setPosition(
      placement === "above"
        ? { bottom: viewportHeight - (rect?.top ?? 0) + GAP, left }
        : { top: (rect?.bottom ?? 0) + GAP, left },
    );
  }, [align, width, placement]);

  React.useEffect(() => {
    if (!open) return;
    reposition();
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains?.(target) || panelRef.current?.contains?.(target)) return;
      onCloseRef.current();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onEscapeRef.current?.();
      onCloseRef.current();
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
  }, [open, reposition]);

  return (
    <>
      {/* @ts-expect-error — on web Box forwards the ref to its DOM node. */}
      <Box ref={anchorRef} className={anchorClassName}>
        {anchor}
      </Box>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              {...webDomProps({
                role,
                "data-testid": testID,
                className: panelClassName,
              })}
              style={{
                position: "fixed",
                top: position.top,
                bottom: position.bottom,
                left: position.left,
                width,
                zIndex: 1000,
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
