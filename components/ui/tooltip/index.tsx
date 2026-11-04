// components/ui/tooltip/index.tsx
// Native tooltip: long-press the trigger to show the text above it; it hides
// itself after a moment or when the trigger is pressed. The web variant
// (index.web.tsx) shows on hover and keyboard focus with role="tooltip".
import * as React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";

export type TooltipProps = {
  /** The tooltip text (e.g. the NAV error reason). */
  content: string;
  /** One pressable trigger element; on native it receives `onLongPress`. */
  children: React.ReactElement<{ onLongPress?: () => void; onPress?: () => void }>;
  testID?: string;
};

export const TOOLTIP_AUTOHIDE_MS = 2500;

export function Tooltip({ content, children, testID = "tooltip" }: TooltipProps) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), TOOLTIP_AUTOHIDE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  const trigger = React.cloneElement(children, {
    onLongPress: () => setOpen(true),
    onPress: () => {
      setOpen(false);
      children.props.onPress?.();
    },
  });

  return (
    <Box className="relative items-center">
      {trigger}
      {open ? (
        <Box
          testID={testID}
          accessibilityRole="text"
          pointerEvents="none"
          className="absolute bottom-full z-50 mb-1.5 max-w-[260px] rounded-control bg-navy px-2.5 py-[7px] shadow-tooltip"
        >
          <Text className="text-xs leading-[1.4] text-white">{content}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
