// components/invoices/composer/ComposerPage.tsx
// The one-page skeleton shared by Új számla, Piszkozat szerkesztése and Új
// nyugta (redesign 2026-11, SPEC §8, tokens.md §6.18): breadcrumb, a sticky
// action bar (h1 + "Előnézet"), the form sections, an optional preview and a
// sticky bottom bar. The preview is closed on load: from 1100px "Előnézet"
// opens it as a 420px column beside the form, below that as a Sheet.
import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions } from "react-native";
import { FileText } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Sheet } from "@/components/ui/sheet";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/Breadcrumb";
import { previewPresentation } from "@/components/invoices/composer/composer-view";
import { LAYOUT } from "@/lib/theme/layout";
import { useIconColors } from "@/lib/theme/icon-colors";
import { type } from "@/lib/ui/type";

export type ComposerPageProps = {
  breadcrumb: BreadcrumbItem[];
  title: string;
  /** Small status text left of the preview button (unsaved / saved at). Hidden on phones. */
  status?: React.ReactNode;
  /**
   * Renders the preview body; called only while the preview is open, so nothing
   * is fetched before "Előnézet" is pressed. Receives the close handler and the
   * frame height that fits the current presentation. Omit for no preview button.
   */
  renderPreview?: (args: { onClose: () => void; height: number }) => React.ReactNode;
  /** Rendered between the action bar and the sections (notices, banners). */
  notices?: React.ReactNode;
  /** The sections of the form. */
  children: React.ReactNode;
  /** Sticky bottom bar. */
  bottomBar: React.ReactNode;
  /** Toast overlay etc., rendered above everything. */
  overlay?: React.ReactNode;
  testID?: string;
};

export function ComposerPage({
  breadcrumb,
  title,
  status,
  renderPreview,
  notices,
  children,
  bottomBar,
  overlay,
  testID = "composer-page",
}: ComposerPageProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const { width, height } = useWindowDimensions();
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const presentation = previewPresentation(width);
  const side = presentation === "side";
  const phone = width <= LAYOUT.phoneMax;
  const hasPreview = Boolean(renderPreview);
  const closePreview = React.useCallback(() => setPreviewOpen(false), []);

  // The sheet (below 1100) leaves 96px at the top on phones; a dialog above 700.
  const sheetHeight = Math.max(360, Math.round(height - (phone ? 96 : 200) - 120));
  const sideHeight = Math.max(480, Math.round(height - 220));

  return (
    <Box className="flex-1 bg-canvas" testID={testID}>
      {overlay}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1"
          // The action bar (index 1) sticks to the top while the form scrolls.
          stickyHeaderIndices={[1]}
          contentContainerClassName="mx-auto w-full max-w-[1240px] pb-10"
          keyboardShouldPersistTaps="handled"
        >
          <Box className="px-4 pt-4 tab:px-6">
            <Breadcrumb items={breadcrumb} />
          </Box>

          <Box className="bg-canvas px-4 pb-3 pt-2 tab:px-6" testID="composer-action-bar">
            <HStack className="min-h-[42px] items-center justify-between gap-3">
              <Heading className={`${type.pageTitle} min-w-0 flex-1`} accessibilityRole="header">
                {title}
              </Heading>
              <HStack className="items-center gap-3">
                {status && !phone ? <Box>{status}</Box> : null}
                {hasPreview ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => setPreviewOpen((open) => !open)}
                    accessibilityLabel={t("invoices.composer.openFullPreview")}
                    aria-expanded={previewOpen}
                    className={previewOpen ? "border-primary" : ""}
                    testID="composer-open-preview"
                  >
                    <FileText size={16} color={icons.foreground} />
                    {phone ? null : <ButtonText>{t("invoices.composer.openFullPreview")}</ButtonText>}
                  </Button>
                ) : null}
              </HStack>
            </HStack>
          </Box>

          <Box className="px-4 tab:px-6">
            {notices}
            <Box className={side && previewOpen && hasPreview ? "flex-row items-start gap-6" : ""}>
              <Box className="min-w-0 flex-1" testID="composer-form-column">
                {children}
              </Box>
              {side && previewOpen && hasPreview ? (
                <Box className="sticky top-20 w-[420px] shrink-0" testID="composer-side-preview">
                  {renderPreview!({ onClose: closePreview, height: sideHeight })}
                </Box>
              ) : null}
            </Box>
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>

      {bottomBar}

      {hasPreview && !side ? (
        <Sheet
          open={previewOpen}
          onClose={closePreview}
          presentation="auto"
          maxWidth={640}
          topOffset={96}
          hideHeader
          accessibilityLabel={t("composer.previewSheetTitle")}
          testID="composer-preview-sheet"
        >
          {previewOpen ? (
            <Box className="pb-2">{renderPreview!({ onClose: closePreview, height: sheetHeight })}</Box>
          ) : null}
        </Sheet>
      ) : null}
    </Box>
  );
}
