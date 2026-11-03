// components/search/GlobalSearchResults.web.tsx
// Web twin: the results panel is a portal to <body> with position:fixed from
// the field's rect (every View gets its own stacking context on web, so an
// absolutely positioned child of the top bar would be painted under the page).
// Popover: right-aligned to the field, min(460px, 100vw - 16px) wide, radius
// 12, padding 6, max-height min(70vh, 520px). Phone panel: the field's width.
import * as React from "react";
import { SearchResultsPanel } from "@/components/search/SearchResultsPanel";
import type { GlobalSearchResultsProps } from "@/components/search/GlobalSearchResults";

const { createPortal } = require("react-dom") as {
  createPortal: (children: React.ReactNode, container: Element) => React.ReactPortal;
};

export type { GlobalSearchResultsProps } from "@/components/search/GlobalSearchResults";

const GAP = 6;
const MARGIN = 8;
const POPOVER_WIDTH = 460;

type Rect = { top: number; left: number; right: number; width: number };

function Anchored({
  anchor,
  variant,
  children,
}: {
  anchor: HTMLElement | null;
  variant: "popover" | "panel";
  children: React.ReactNode;
}) {
  const [rect, setRect] = React.useState<Rect | null>(null);

  React.useLayoutEffect(() => {
    if (!anchor) return;
    function measure() {
      const box = anchor!.getBoundingClientRect();
      setRect({ top: box.bottom + GAP, left: box.left, right: box.right, width: box.width });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchor]);

  if (!rect) return null;
  const viewport = window.innerWidth;
  const width = variant === "panel" ? rect.width : Math.min(POPOVER_WIDTH, viewport - MARGIN * 2);
  const left =
    variant === "panel" ? rect.left : Math.max(MARGIN, Math.min(rect.right - width, viewport - width - MARGIN));

  return createPortal(
    <div
      data-testid="global-search-results"
      className="fixed z-[1000] overflow-y-auto rounded-menu border border-line-strong bg-surface p-1.5 shadow-menu"
      style={{ top: rect.top, left, width, maxHeight: "min(70vh, 520px)" }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function GlobalSearchResults({ query, onClose, variant = "popover" }: GlobalSearchResultsProps) {
  // The marker sits inside the field's box; its parent is that box.
  const markerRef = React.useRef<HTMLSpanElement | null>(null);
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    setAnchor(markerRef.current?.parentElement ?? null);
  }, []);

  return (
    <>
      <span ref={markerRef} aria-hidden="true" className="hidden" />
      <SearchResultsPanel
        query={query}
        onClose={onClose}
        renderContainer={(body) => (
          <Anchored anchor={anchor} variant={variant}>
            {body}
          </Anchored>
        )}
      />
    </>
  );
}
