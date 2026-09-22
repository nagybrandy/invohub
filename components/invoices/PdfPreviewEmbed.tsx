// components/invoices/PdfPreviewEmbed.tsx
// Embeds a PDF URL in the browser (same-origin API or blob URL). Web only —
// native has no inline PDF viewer; callers offer "open PDF" there instead.
//
// Double-buffered: when `src` changes, the new PDF loads in an iframe
// stacked UNDER the visible one (z-index, not visibility:hidden — Chrome's
// PDF viewer does not paint inside a hidden frame) and is raised only once
// it has loaded and painted (or after a fallback), then the old frame is
// dropped — so a live preview never flashes between renders. Frames are only ever
// appended and removed from the front, so React never MOVES an iframe node
// (moving one would reload it).
import * as React from "react";
import { isWeb } from "@/lib/platform";

/** Fit the page to the frame width in browser PDF viewers that honour open parameters. */
export function pdfViewerSrc(src: string): string {
  return src.includes("#") ? src : `${src}#view=FitH`;
}

const SWAP_FALLBACK_MS = 3000;
// Chrome's built-in viewer fires `load` once its shell is up, a beat before
// the page itself is painted (a dark empty viewer) — hold the swap briefly.
export const SWAP_AFTER_LOAD_MS = 450;

type Frame = { src: string; loaded: boolean };

export function PdfPreviewEmbed({
  src,
  title,
  minHeight,
  testID,
}: {
  src: string;
  title: string;
  minHeight: number;
  testID?: string;
}) {
  const [frames, setFrames] = React.useState<Frame[]>(() => (src ? [{ src, loaded: true }] : []));

  React.useEffect(() => {
    if (!src) return;
    setFrames((current) => {
      if (current.some((f) => f.src === src)) return current;
      // Nothing visible yet: show the first render straight away.
      return current.length === 0 ? [{ src, loaded: true }] : [...current, { src, loaded: false }];
    });
    const fallback = setTimeout(() => markLoaded(src), SWAP_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [src]);

  function markLoaded(loadedSrc: string) {
    setFrames((current) => {
      const index = current.findIndex((f) => f.src === loadedSrc);
      if (index === -1) return current;
      // Keep the loaded frame and anything newer; drop the older ones.
      return current.slice(index).map((f, i) => (i === 0 ? { ...f, loaded: true } : f));
    });
  }

  if (!isWeb() || frames.length === 0) {
    return null;
  }

  const visible = [...frames].reverse().find((f) => f.loaded) ?? frames[0]!;

  return React.createElement(
    "div",
    {
      "data-testid": testID,
      style: { position: "relative", width: "100%", height: minHeight, background: "white" },
    },
    frames.map((frame) =>
      React.createElement("iframe", {
        key: frame.src,
        title,
        src: pdfViewerSrc(frame.src),
        onLoad: () => {
          if (frame.loaded) return;
          setTimeout(() => markLoaded(frame.src), SWAP_AFTER_LOAD_MS);
        },
        "aria-hidden": frame === visible ? undefined : true,
        style: {
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "none",
          background: "white",
          zIndex: frame === visible ? 2 : 1,
        },
      })
    )
  );
}
