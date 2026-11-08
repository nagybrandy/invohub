// components/invoices/composer/PartnerListOverlay.web.tsx
// Web variant: the open suggestion list is portalled to document.body and
// positioned `fixed` from the input's rect. react-native-web gives every View
// its own stacking context (z-index 0), so a list rendered inside the
// composer could never paint above later sections ("Dátumok és fizetés",
// "Mit számlázol?"). Same escape as AnchoredPopover.web — but mousedown on the
// panel is default-prevented so the input keeps focus (no blur-to-close race
// before a row's press lands). The style is set on the div directly; never
// through webDomProps, which strips `style`.
import * as React from "react";
import { webDomProps } from "@/components/ui/web-dom-props";
import {
  PARTNER_LIST_PANEL_CLASS,
  type PartnerListOverlayProps,
} from "@/components/invoices/composer/partner-list-shared";

const { createPortal } = require("react-dom") as {
  createPortal: (children: React.ReactNode, container: Element) => React.ReactPortal;
};

const GAP = 4;

type Position = { top: number; left: number; width: number };

export function PartnerListOverlay({ open, anchorRef, id, testID, children }: PartnerListOverlayProps) {
  const [position, setPosition] = React.useState<Position | null>(null);

  const reposition = React.useCallback(() => {
    const node = anchorRef.current as HTMLElement | null;
    if (!node || typeof node.getBoundingClientRect !== "function") return;
    const rect = node.getBoundingClientRect();
    setPosition({ top: rect.bottom + GAP, left: rect.left, width: rect.width });
  }, [anchorRef]);

  React.useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  if (!open || !position || typeof document === "undefined") return null;

  return createPortal(
    <div
      {...webDomProps({
        id,
        role: "listbox",
        "data-testid": testID,
        className: PARTNER_LIST_PANEL_CLASS,
      })}
      onMouseDown={(event) => event.preventDefault()}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 1000,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
