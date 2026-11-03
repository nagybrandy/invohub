// components/ui/sheet/layout.ts
// Shared Sheet decisions: bottom sheet up to the phone breakpoint, centred
// dialog (max 460 wide) above it (tokens.md §6.13).
import { LAYOUT } from "@/lib/theme/layout";

export type SheetPresentation = "auto" | "sheet" | "dialog";
export type ResolvedPresentation = "sheet" | "dialog";

export const DIALOG_MAX_WIDTH = 460;

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  /** Visible heading; also the accessible name unless `accessibilityLabel` is given. */
  title?: string;
  accessibilityLabel?: string;
  /** Label of the close button. Defaults to the i18n `ui.close`. */
  closeLabel?: string;
  /** Rendered under the body with a top border (dialog actions). */
  footer?: import("react").ReactNode;
  children?: import("react").ReactNode;
  /** `auto` (default): bottom sheet <= 700px, centred dialog above. */
  presentation?: SheetPresentation;
  /** Dialog width cap in px (default 460). */
  maxWidth?: number;
  /** Phone only: leave this many px at the top (the composer preview sheet uses 96). */
  topOffset?: number;
  /** Omit the title row and close button (the caller renders its own). */
  hideHeader?: boolean;
  testID?: string;
};

export function resolvePresentation(
  presentation: SheetPresentation | undefined,
  width: number,
): ResolvedPresentation {
  if (presentation === "sheet" || presentation === "dialog") return presentation;
  return width <= LAYOUT.phoneMax ? "sheet" : "dialog";
}
