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

export const MAX_MENU_ITEMS = 5;

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

/** Warns (development only) when a menu is given more than the design allows. */
export function warnIfTooManyItems(count: number): void {
  if (count > MAX_MENU_ITEMS && process.env.NODE_ENV !== "production") {
    console.warn(
      `[OverflowMenu] ${count} actions given; the design allows at most ${MAX_MENU_ITEMS}. Move the rest to the detail page.`,
    );
  }
}

export const MENU_TRIGGER_CLASS =
  "h-[34px] w-[34px] phone:h-10 phone:w-10 items-center justify-center rounded-control data-[hover=true]:bg-neutral-wash";
export const MENU_ITEM_CLASS =
  "min-h-11 flex-row items-center gap-3.5 rounded-control px-3.5 py-3 data-[hover=true]:bg-neutral-wash";

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
