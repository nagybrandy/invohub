// components/invoices/composer/PartnerListOverlay.tsx
// Native twin of PartnerListOverlay.web.tsx: the suggestion list stays inline,
// absolutely positioned under the field. (On web it is portalled to
// document.body so it can out-stack the later composer sections.)
import * as React from "react";
import { Box } from "@/components/ui/box";
import {
  PARTNER_LIST_PANEL_CLASS,
  type PartnerListOverlayProps,
} from "@/components/invoices/composer/partner-list-shared";
import { LISTBOX_ROLE } from "@/lib/ui/tap-target";

export function PartnerListOverlay({ open, id, testID, children }: PartnerListOverlayProps) {
  if (!open) return null;
  return (
    <Box
      nativeID={id}
      role={LISTBOX_ROLE}
      accessibilityRole="list"
      className={`absolute left-0 right-0 top-[46px] z-40 ${PARTNER_LIST_PANEL_CLASS}`}
      testID={testID}
    >
      {children}
    </Box>
  );
}
