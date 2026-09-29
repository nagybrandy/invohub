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
};

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
}: AnchoredPopoverProps) {
  const anchorRef = React.useRef<View | null>(null);
  // Rendered from the first frame at a safe default and moved once the
  // anchor has been measured — measureInWindow answers asynchronously (and
  // not at all under the jest renderer), and a form must never depend on it.
  const [position, setPosition] = React.useState<{ top: number; left: number }>({ top: MARGIN, left: MARGIN });

  React.useEffect(() => {
    if (!open) return;
    const node = anchorRef.current;
    if (!node || typeof node.measureInWindow !== "function") return;
    node.measureInWindow((x, y, w, h) => {
      const screen = Dimensions.get("window").width;
      const rawLeft = align === "right" ? x + w - width : x;
      setPosition({
        top: y + h + GAP,
        left: Math.max(MARGIN, Math.min(rawLeft, screen - width - MARGIN)),
      });
    });
  }, [open, align, width]);

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
          className="absolute rounded-xl border border-subtle bg-surface-raised p-4 shadow-md"
          style={{ top: position.top, left: position.left, width }}
        >
          {children}
        </Box>
      </Modal>
    </>
  );
}
