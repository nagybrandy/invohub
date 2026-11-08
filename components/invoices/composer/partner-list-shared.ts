// components/invoices/composer/partner-list-shared.ts
// Platform-neutral pieces of PartnerListOverlay(.web). Separate file because on
// web "@/components/invoices/composer/PartnerListOverlay" resolves to the .web
// file itself, so it cannot import runtime values from its native twin.
import type * as React from "react";

export const PARTNER_LIST_PANEL_CLASS =
  "overflow-hidden rounded-menu border border-line-strong bg-surface p-1.5 shadow-menu";

export type PartnerListOverlayProps = {
  open: boolean;
  /** The element the list hangs under (the input wrapper). Used on web only. */
  anchorRef: React.RefObject<unknown>;
  id: string;
  testID: string;
  children: React.ReactNode;
};
