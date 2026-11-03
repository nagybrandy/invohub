// components/ui/sheet/index.tsx
// Native Sheet: a transparent RN Modal with a scrim, a bottom sheet on phones
// and a centred dialog on wider screens (tokens.md §6.13). The web
// implementation (index.web.tsx) adds the DOM focus trap, Esc handling and
// focus restore; React Native's Modal already traps the screen reader focus
// and maps Android's back button to onRequestClose.
import * as React from "react";
import { Modal, ScrollView, useWindowDimensions } from "react-native";
import * as SafeArea from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Pressable } from "@/components/ui/pressable";
import { useIconColors } from "@/lib/theme/icon-colors";
import {
  DIALOG_MAX_WIDTH,
  resolvePresentation,
  type SheetProps,
} from "@/components/ui/sheet/layout";

// The context is read directly (not via useSafeAreaInsets, which throws without
// a provider) so a Sheet also renders in trees that have none.
const NoInsets = React.createContext<{ bottom: number } | null>(null);
const InsetsContext: React.Context<{ bottom: number } | null> =
  (SafeArea as { SafeAreaInsetsContext?: React.Context<{ bottom: number } | null> }).SafeAreaInsetsContext ?? NoInsets;

export type { SheetProps } from "@/components/ui/sheet/layout";
export { resolvePresentation, DIALOG_MAX_WIDTH } from "@/components/ui/sheet/layout";

export function Sheet({
  open,
  onClose,
  title,
  accessibilityLabel,
  closeLabel,
  footer,
  children,
  presentation,
  maxWidth = DIALOG_MAX_WIDTH,
  topOffset,
  hideHeader = false,
  testID = "sheet",
}: SheetProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = React.useContext(InsetsContext);
  const icons = useIconColors();
  const kind = resolvePresentation(presentation, width);
  const isSheet = kind === "sheet";
  const label = closeLabel ?? t("ui.close");

  return (
    <Modal visible={open} transparent animationType={isSheet ? "slide" : "fade"} onRequestClose={onClose}>
      <Box
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityViewIsModal
        className={`flex-1 ${isSheet ? "justify-end" : "items-center justify-center px-4"}`}
        style={isSheet && topOffset ? { paddingTop: topOffset } : undefined}
      >
        <Pressable
          testID={`${testID}-scrim`}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onClose}
          className="absolute inset-0 bg-[rgba(10,16,40,0.5)]"
        />
        <Box
          className={
            isSheet
              ? "max-h-[88%] rounded-t-sheet bg-surface px-4 pt-2 shadow-sheet"
              : "max-h-[90%] w-full rounded-dialog bg-surface shadow-dialog"
          }
          style={
            isSheet
              ? { paddingBottom: 14 + (insets?.bottom ?? 0) }
              : { maxWidth }
          }
        >
          {isSheet ? <Box className="mx-auto mb-1.5 mt-1 h-1 w-10 rounded-sm bg-line-strong" /> : null}
          {hideHeader ? null : (
            <Box className={`flex-row items-center justify-between gap-3 ${isSheet ? "pb-2" : "px-5 pb-2 pt-[18px]"}`}>
              {title ? (
                <Heading
                  accessibilityRole="header"
                  className="min-w-0 flex-1 font-heading text-base font-bold text-ink"
                >
                  {title}
                </Heading>
              ) : (
                <Box className="flex-1" />
              )}
              <Pressable
                testID={`${testID}-close`}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={onClose}
                className="h-[38px] w-[38px] items-center justify-center rounded-full bg-neutral-wash"
              >
                <X size={18} color={icons.muted} />
              </Pressable>
            </Box>
          )}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            className="flex-shrink"
            contentContainerClassName={isSheet ? "" : "px-5 pb-3 pt-1"}
          >
            {children}
          </ScrollView>
          {footer ? (
            <Box className={isSheet ? "pt-2" : "border-t border-line px-5 pb-[18px] pt-3"}>{footer}</Box>
          ) : null}
        </Box>
      </Box>
    </Modal>
  );
}
