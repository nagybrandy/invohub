// components/ui/confirm-dialog/types.ts
import type { LucideIcon } from "lucide-react-native";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Red icon circle and a solid red confirm button. */
  destructive?: boolean;
  /** Icon in the circle above the title. */
  icon?: LucideIcon;
  /** Disables both buttons and shows the confirm button as busy. */
  busy?: boolean;
  onConfirm: () => void;
  /** Mégse, Esc, scrim click and the close button all call this. */
  onCancel: () => void;
  testID?: string;
};

/** Max width of a confirm modal (tokens.md §6.13: min(400px, 100%)). */
export const CONFIRM_MAX_WIDTH = 400;
