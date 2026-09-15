// components/layout/OverflowMenu.tsx
// "⋯" popover menu shared by table rows, PageHeader and the invoice detail
// screen. Destructive items render in the destructive color and should be
// passed last (D1 — a destructive action never looks like a neutral one).
import * as React from "react";
import { MoreHorizontal } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useIconColors } from "@/lib/theme/icon-colors";

export type OverflowMenuItem = {
  label: string;
  onPress: () => void;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  destructive?: boolean;
  disabled?: boolean;
};

type OverflowMenuProps = {
  items: OverflowMenuItem[];
  /** Accessible label for the trigger button. */
  label?: string;
  align?: "left" | "right";
};

export function OverflowMenu({ items, label = "More actions", align = "right" }: OverflowMenuProps) {
  const [open, setOpen] = React.useState(false);
  const icons = useIconColors();

  if (items.length === 0) return null;

  return (
    <Box className="relative">
      <Pressable
        testID="overflow-menu-trigger"
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={(e: { stopPropagation?: () => void }) => {
          e?.stopPropagation?.();
          setOpen((v) => !v);
        }}
        hitSlop={8}
        className="h-8 w-8 items-center justify-center rounded-lg data-[hover=true]:bg-muted"
      >
        <MoreHorizontal size={18} color={icons.muted} />
      </Pressable>
      {open ? (
        <VStack
          testID="overflow-menu-content"
          className={`absolute top-full z-50 mt-1 min-w-[200px] gap-0.5 rounded-lg border border-subtle bg-surface-raised p-1 shadow-sm ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={`${item.label}-${index}`}
                testID={`overflow-menu-item-${index}`}
                disabled={item.disabled}
                accessibilityRole="button"
                onPress={(e: { stopPropagation?: () => void }) => {
                  e?.stopPropagation?.();
                  setOpen(false);
                  item.onPress();
                }}
                className={`flex-row items-center gap-2 rounded-md px-3 py-2 data-[hover=true]:bg-muted ${
                  item.disabled ? "opacity-40" : ""
                }`}
              >
                {Icon ? (
                  <Icon size={16} color={item.destructive ? icons.destructive : icons.muted} />
                ) : null}
                <Text size="sm" className={item.destructive ? "text-destructive" : "text-foreground"}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </VStack>
      ) : null}
    </Box>
  );
}
