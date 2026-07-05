// components/invoices/PdfPreviewEmbed.tsx
// Embeds a PDF URL in the browser (same-origin API or blob URL).
import * as React from "react";
import { isWeb } from "@/lib/platform";

export function PdfPreviewEmbed({
  src,
  title,
  minHeight,
}: {
  src: string;
  title: string;
  minHeight: number;
}) {
  if (!isWeb() || !src) {
    return null;
  }

  return React.createElement("iframe", {
    title,
    src,
    style: {
      width: "100%",
      height: minHeight,
      border: "none",
      background: "white",
    },
  });
}
