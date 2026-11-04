// components/layout/OverflowMenu.tsx
// "⋯" popover menu shared by table rows, PageHeader and the invoice detail
// screen (tokens.md §6.14): 12px radius, line-strong border, 14/500 rows with
// muted icons, hover/focus on --neutral-wash. Destructive items render in the
// err colour and should be passed last (D1 — a destructive action never looks
// like a neutral one). At most FIVE actions: more is a design bug and warns in
// development (the lists never offer send / NAV actions here).
import * as React from "react";
import { MoreVertical } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useIconColors } from "@/lib/theme/icon-colors";
import {
  MAX_MENU_ITEMS,
  MENU_ITEM_CLASS,
  MENU_TRIGGER_CLASS,
  warnIfTooManyItems,
  type OverflowMenuItem,
} from "@/components/layout/menu-shared";

export { MAX_MENU_ITEMS, MENU_ITEM_CLASS, MENU_TRIGGER_CLASS, warnIfTooManyItems };
export type { OverflowMenuItem };

type OverflowMenuProps = {
  items: OverflowMenuItem[];
  /** Accessible label for the trigger button. */
  label?: string;
  align?: "left" | "right";
};

export function OverflowMenu({ items, label = "More actions", align = "right" }: OverflowMenuProps) {
  const [open, setOpen] = React.useState(false);
  const icons = useIconColors();

  warnIfTooManyItems(items.length);
  if (items.length === 0) return null;

  return (
    <Box className="relative">
      <Pressable
        testID="overflow-menu-trigger"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={(e: { stopPropagation?: () => void }) => {
          e?.stopPropagation?.();
          setOpen((v) => !v);
        }}
        hitSlop={8}
        className={MENU_TRIGGER_CLASS}
      >
        <MoreVertical size={18} color={icons.muted} />
      </Pressable>
      {open ? (
        <VStack
          testID="overflow-menu-content"
          className={`absolute top-full z-50 mt-1 min-w-[230px] gap-0.5 rounded-menu border border-line-strong bg-surface p-1.5 shadow-menu ${
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
                accessibilityRole="menuitem"
                onPress={(e: { stopPropagation?: () => void }) => {
                  e?.stopPropagation?.();
                  setOpen(false);
                  item.onPress();
                }}
                className={`${MENU_ITEM_CLASS} ${item.disabled ? "opacity-40" : ""}`}
              >
                {Icon ? (
                  <Icon size={18} color={item.destructive ? icons.destructive : icons.muted} />
                ) : null}
                <Text size="sm" className={`font-medium ${item.destructive ? "text-err" : "text-ink"}`}>
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
