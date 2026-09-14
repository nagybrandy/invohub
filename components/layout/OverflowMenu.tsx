// components/layout/OverflowMenu.tsx
// "···" trigger + popover list — table row actions, PageHeader overflow,
// detail-page "Továbbiak ▾" menu. Native/default renderer; see
// OverflowMenu.web.tsx for the DOM click-outside variant.
import { useState } from "react";
import { MoreHorizontal } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useIconColors } from "@/lib/theme/icon-colors";
import type { LucideIcon } from "lucide-react-native";

export type OverflowMenuItem = {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  /** Destructive items get destructive text and sit visually apart (D1). */
  destructive?: boolean;
};

export type OverflowMenuProps = {
  items: OverflowMenuItem[];
  /** Optional custom trigger; defaults to a "···" icon button. */
  trigger?: React.ReactNode;
  /** Internal — lets OverflowMenu.web.tsx control open state (outside-click-to-close). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** Shared trigger button, extracted so the web variant can reuse it. */
export function OverflowMenuTrigger({
  onPress,
  trigger,
}: {
  onPress: () => void;
  trigger?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const icons = useIconColors();
  return (
    <Pressable
      testID="overflow-menu-trigger"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("common.moreActions")}
      className="h-8 w-8 items-center justify-center rounded-lg data-[hover=true]:bg-muted"
    >
      {trigger ?? <MoreHorizontal size={18} color={icons.muted} />}
    </Pressable>
  );
}

/** Shared item list, extracted so the web variant can reuse it. */
export function OverflowMenuList({
  items,
  onItemPress,
}: {
  items: OverflowMenuItem[];
  onItemPress: (item: OverflowMenuItem) => void;
}) {
  const icons = useIconColors();
  return (
    <Box
      testID="overflow-menu-list"
      className="absolute right-0 top-9 z-50 min-w-[180px] rounded-lg border border-subtle bg-surface-raised p-1 shadow-sm"
    >
      <VStack>
        {items.map((item, index) => (
          <Pressable
            key={`${item.label}-${index}`}
            testID="overflow-menu-item"
            onPress={() => onItemPress(item)}
            accessibilityRole="menuitem"
            className="flex-row items-center gap-2 rounded-md px-2.5 py-2 data-[hover=true]:bg-muted"
          >
            {item.icon ? (
              <item.icon
                size={16}
                color={item.destructive ? icons.destructive : icons.muted}
              />
            ) : null}
            <Text
              size="sm"
              className={item.destructive ? "text-destructive" : "text-foreground"}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </VStack>
    </Box>
  );
}

export function OverflowMenu({ items, trigger, open: openProp, onOpenChange }: OverflowMenuProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;

  return (
    <Box testID="overflow-menu" className="relative">
      <OverflowMenuTrigger onPress={() => setOpen(!open)} trigger={trigger} />
      {open ? (
        <OverflowMenuList
          items={items}
          onItemPress={(item) => {
            setOpen(false);
            item.onPress();
          }}
        />
      ) : null}
    </Box>
  );
}
