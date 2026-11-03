// components/ui/confirm-dialog/index.web.tsx
// Web confirm dialog: pure DOM on the web Sheet, so it can also be mounted
// outside the React Native tree by `confirmAsync` (lib/ui/confirm.web.tsx).
// Cancel carries data-autofocus: the safe choice has focus when it opens.
import * as React from "react";
import { useWindowDimensions } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { Sheet } from "@/components/ui/sheet/index.web";
import { resolvePresentation } from "@/components/ui/sheet/layout";
import { useIconColors } from "@/lib/theme/icon-colors";
import { CONFIRM_MAX_WIDTH, type ConfirmDialogProps } from "@/components/ui/confirm-dialog/types";

export type { ConfirmDialogProps } from "@/components/ui/confirm-dialog/types";

const BUTTON =
  "inline-flex h-[42px] cursor-pointer items-center justify-center rounded-control px-4 text-sm font-semibold disabled:cursor-default disabled:opacity-40";
const SECONDARY = `${BUTTON} border border-line-strong bg-surface text-ink hover:bg-neutral-wash`;
const PRIMARY = `${BUTTON} border-0 bg-primary text-primary-foreground hover:bg-primary-press`;
const DANGER_SOLID = `${BUTTON} border-0 bg-err text-white hover:opacity-90`;

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
  const full = isSheet ? " w-full" : "";

  const confirm = (
    <button
      key="confirm"
      type="button"
      data-testid={`${testID}-confirm`}
      disabled={busy}
      onClick={onConfirm}
      className={(destructive ? DANGER_SOLID : PRIMARY) + full}
    >
      {confirmLabel}
    </button>
  );
  const cancel = (
    <button
      key="cancel"
      type="button"
      data-testid={`${testID}-cancel`}
      data-autofocus=""
      disabled={busy}
      onClick={onCancel}
      className={SECONDARY + full}
    >
      {cancelLabel}
    </button>
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
      <div className={`flex flex-col gap-3 ${isSheet ? "pb-2 pt-2" : "px-1 pb-2 pt-5"}`}>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full ${destructive ? "bg-err-wash" : "bg-primary-wash"}`}
        >
          <Icon size={20} color={destructive ? icons.destructive : icons.primary} />
        </div>
        <h2 className="m-0 font-heading text-base font-bold text-ink">{title}</h2>
        {message ? <p className="m-0 text-sm text-muted-ink">{message}</p> : null}
        <div className={isSheet ? "mt-2 flex flex-col gap-2" : "mt-3 flex justify-end gap-2.5"}>
          {isSheet ? [confirm, cancel] : [cancel, confirm]}
        </div>
      </div>
    </Sheet>
  );
}
