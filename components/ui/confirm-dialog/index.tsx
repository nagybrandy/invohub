// components/ui/confirm-dialog/index.tsx
// Native confirm dialog on the Sheet: icon circle, title, text, Mégse + the
// action (tokens.md §6.13). On phones it is a bottom sheet with stacked
// full-width actions, primary on top; on wider screens a centred dialog with
// right-aligned actions. The web twin (index.web.tsx) is pure DOM.
import * as React from "react";
import { useWindowDimensions } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Sheet } from "@/components/ui/sheet";
import { resolvePresentation } from "@/components/ui/sheet/layout";
import { useIconColors } from "@/lib/theme/icon-colors";
import { CONFIRM_MAX_WIDTH, type ConfirmDialogProps } from "@/components/ui/confirm-dialog/types";

export type { ConfirmDialogProps } from "@/components/ui/confirm-dialog/types";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  icon,
  busy = false,
  onConfirm,
  onCancel,
  testID = "confirm-dialog",
}: ConfirmDialogProps) {
  const { width } = useWindowDimensions();
  const icons = useIconColors();
  const Icon = icon ?? AlertTriangle;
  const isSheet = resolvePresentation("auto", width) === "sheet";

  const confirm = (
    <Button
      key="confirm"
      testID={`${testID}-confirm`}
      variant={destructive ? "dangerSolid" : "primary"}
      size="form"
      isDisabled={busy}
      onPress={onConfirm}
      className={isSheet ? "w-full" : undefined}
    >
      {busy ? <ButtonSpinner /> : null}
      <ButtonText>{confirmLabel}</ButtonText>
    </Button>
  );
  const cancel = (
    <Button
      key="cancel"
      testID={`${testID}-cancel`}
      variant="secondary"
      size="form"
      isDisabled={busy}
      onPress={onCancel}
      className={isSheet ? "w-full" : undefined}
    >
      <ButtonText>{cancelLabel}</ButtonText>
    </Button>
  );

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      accessibilityLabel={title}
      hideHeader
      maxWidth={CONFIRM_MAX_WIDTH}
      testID={testID}
    >
      <Box className={isSheet ? "gap-3 pb-2 pt-2" : "gap-3 px-1 pb-2 pt-5"}>
        <Box
          className={`h-11 w-11 items-center justify-center rounded-full ${destructive ? "bg-err-wash" : "bg-primary-wash"}`}
        >
          <Icon size={20} color={destructive ? icons.destructive : icons.primary} />
        </Box>
        <Heading accessibilityRole="header" className="font-heading text-base font-bold text-ink">
          {title}
        </Heading>
        {message ? <Text className="text-sm text-muted-ink">{message}</Text> : null}
        <Box className={isSheet ? "mt-2 gap-2" : "mt-3 flex-row justify-end gap-2.5"}>
          {isSheet ? [confirm, cancel] : [cancel, confirm]}
        </Box>
      </Box>
    </Sheet>
  );
}
