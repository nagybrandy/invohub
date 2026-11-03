// components/ui/tooltip/index.web.tsx
// Web tooltip: shows on hover and keyboard focus, hides on leave / blur / Esc.
// Rendered through a portal with position:fixed so a table's overflow:hidden
// card or a row's stacking context can never clip it. The trigger wrapper gets
// aria-describedby while the tooltip is visible (role="tooltip").
import * as React from "react";
import type { TooltipProps } from "@/components/ui/tooltip";

const { createPortal } = require("react-dom") as {
  createPortal: (children: React.ReactNode, container: Element) => React.ReactPortal;
};

export type { TooltipProps } from "@/components/ui/tooltip";

const GAP = 8;
const MARGIN = 8;

type Position = { top: number; left: number; below: boolean };

export function Tooltip({ content, children, testID = "tooltip" }: TooltipProps) {
  const id = React.useId();
  const wrapperRef = React.useRef<HTMLSpanElement | null>(null);
  const bubbleRef = React.useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<Position | null>(null);

  const place = React.useCallback(() => {
    const anchor = wrapperRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const bubble = bubbleRef.current?.getBoundingClientRect();
    const bubbleHeight = bubble?.height ?? 32;
    const bubbleWidth = bubble?.width ?? 120;
    const below = rect.top - bubbleHeight - GAP < MARGIN;
    const centre = rect.left + rect.width / 2;
    setPosition({
      below,
      top: below ? rect.bottom + GAP : rect.top - GAP,
      left: Math.max(
        MARGIN + bubbleWidth / 2,
        Math.min(centre, window.innerWidth - MARGIN - bubbleWidth / 2),
      ),
    });
  }, []);

  React.useLayoutEffect(() => {
    if (open) place();
  }, [open, place, content]);

  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  return (
    <>
      <span
        ref={wrapperRef}
        data-testid={`${testID}-trigger`}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={bubbleRef}
              id={id}
              role="tooltip"
              data-testid={testID}
              className="pointer-events-none max-w-[260px] rounded-control bg-navy px-2.5 py-[7px] text-xs leading-[1.4] text-white shadow-tooltip"
              style={{
                position: "fixed",
                zIndex: 2000,
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                transform: position?.below ? "translateX(-50%)" : "translate(-50%, -100%)",
                width: "max-content",
              }}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
