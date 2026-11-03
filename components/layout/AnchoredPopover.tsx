// components/layout/AnchoredPopover.tsx
// A small panel anchored below a trigger — the mark-paid form, and anything
// else that should open next to its button instead of somewhere down the
// page. Native: a transparent Modal (escapes every parent's clipping and
// stacking) with a backdrop that closes it, positioned from the anchor's
// measured window coordinates. Web variant: AnchoredPopover.web.tsx.
import * as React from "react";
import { Dimensions, Modal, Pressable as RNPressable, View } from "react-native";
import { Box } from "@/components/ui/box";

export type AnchoredPopoverProps = {
  open: boolean;
  onClose: () => void;
  /** The trigger; rendered by the popover so it can be measured. */
  anchor: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  /** Panel width in px. */
  width?: number;
  testID?: string;
  /** Open below (default) or above the anchor (the sidebar account menu opens upward). */
  placement?: "below" | "above";
  /** Replaces the default panel look (form popovers: padded card) e.g. for menus. */
  panelClassName?: string;
  /** Classes of the wrapper around the anchor (web: `inline-flex`; pass `flex w-full` to stretch a full-width trigger). */
  anchorClassName?: string;
  /** Accessible role of the panel: `dialog` (default) or `menu`. */
  role?: "dialog" | "menu";
  /** Called when Escape closed the popover (web), so the caller can refocus its trigger. */
  onEscape?: () => void;
};

/** Default panel look: a padded raised card. Menus pass their own (MENU_PANEL_CLASS). */
export const POPOVER_PANEL_CLASS = "rounded-menu border border-line-strong bg-surface p-4 shadow-menu";
/** Menu panel look (tokens.md §6.14): 12px radius, 6px padding, line-strong border. */
export const MENU_PANEL_CLASS = "rounded-menu border border-line-strong bg-surface p-1.5 shadow-menu";

const GAP = 6;
const MARGIN = 8;

export function AnchoredPopover({
  open,
  onClose,
  anchor,
  children,
  align = "right",
  width = 360,
  testID = "anchored-popover",
  placement = "below",
  panelClassName = POPOVER_PANEL_CLASS,
}: AnchoredPopoverProps) {
  const anchorRef = React.useRef<View | null>(null);
  // Rendered from the first frame at a safe default and moved once the
  // anchor has been measured — measureInWindow answers asynchronously (and
  // not at all under the jest renderer), and a form must never depend on it.
  const [position, setPosition] = React.useState<{ top?: number; bottom?: number; left: number }>({
    top: MARGIN,
    left: MARGIN,
  });

  React.useEffect(() => {
    if (!open) return;
    const node = anchorRef.current;
    if (!node || typeof node.measureInWindow !== "function") return;
    node.measureInWindow((x, y, w, h) => {
      const { width: screen, height: screenHeight } = Dimensions.get("window");
      const rawLeft = align === "right" ? x + w - width : x;
      const left = Math.max(MARGIN, Math.min(rawLeft, screen - width - MARGIN));
      setPosition(
        placement === "above"
          ? { bottom: screenHeight - y + GAP, left }
          : { top: y + h + GAP, left },
      );
    });
  }, [open, align, width, placement]);

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        {anchor}
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
        <RNPressable
          accessibilityRole="button"
          accessibilityLabel="close"
          onPress={onClose}
          className="flex-1"
          testID={`${testID}-backdrop`}
        />
        <Box
          testID={testID}
          className={`absolute ${panelClassName}`}
          style={{ top: position.top, bottom: position.bottom, left: position.left, width }}
        >
          {children}
        </Box>
      </Modal>
    </>
  );
}
