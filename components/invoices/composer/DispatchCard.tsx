// components/invoices/composer/DispatchCard.tsx
// "Kiküldés és megfelelőség" (SPEC §8.6): the existing, explicit, default-OFF
// e-mail switch that spells out its consequence (INV-2), and the NAV text the
// app has always shown — a finalized számla goes to NAV automatically when NAV
// submission is configured, a díjbekérő never does. The prototype's E-számla
// switch is not built: the composer has no such option.
import * as React from "react";
import { Box } from "@/components/ui/box";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { ComposerCard } from "@/components/invoices/composer/ComposerSection";
import type { InvoiceComposerState } from "@/components/invoices/composer/useInvoiceComposer";

export function DispatchCard(composer: InvoiceComposerState) {
  const { t, documentType, clientEmail, emailOnSend, setEmailOnSend, canEnableEmailOnSend } = composer;

  return (
    <ComposerCard title={t("invoices.composer.dispatchTitle")} testID="composer-section-dispatch">
      <Box className="gap-5">
        <Box className="flex-row items-start justify-between gap-3">
          <Box className="min-w-0 flex-1">
            <Text className="text-sm font-semibold text-ink">
              {clientEmail
                ? t("invoices.composer.sendEmailLabel", { email: clientEmail })
                : t("invoices.fields.sendEmail")}
            </Text>
            {!clientEmail ? (
              <Text className="text-[13px] text-muted-ink">{t("invoices.composer.sendEmailDisabledHint")}</Text>
            ) : null}
          </Box>
          <Switch
            value={emailOnSend}
            onValueChange={setEmailOnSend}
            disabled={!canEnableEmailOnSend}
            accessibilityLabel={t("invoices.fields.sendEmail")}
            testID="composer-email-switch"
          />
        </Box>

        {/* No toggle: every finalized számla goes to NAV automatically
            (server-side) when NAV is configured; a díjbekérő never does. */}
        {documentType === "invoice" || documentType === "advance" ? (
          <Box testID="composer-nav-auto-note">
            <Text className="text-sm font-semibold text-ink">{t("invoices.fields.navSubmit")}</Text>
            <Text className="text-[13px] text-muted-ink">{t("invoices.fields.navSubmitHint")}</Text>
          </Box>
        ) : null}
      </Box>
    </ComposerCard>
  );
}
