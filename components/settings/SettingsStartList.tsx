// components/settings/SettingsStartList.tsx
// The phone Beállítások start page (tokens.md §6.17): rows of icon tile +
// title + one-line description + chevron, grouped in one card; the logout row
// lives in its own card below (red icon tile).
import * as React from "react";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { settingsItemKeys, type SettingsNavItem } from "@/lib/settings-navigation";
import { useIconColors } from "@/lib/theme/icon-colors";
import { type } from "@/lib/ui/type";

export function SettingsStartRow({
  icon: Icon,
  title,
  description,
  onPress,
  tone = "default",
  chevron = true,
  testID,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  onPress: () => void;
  tone?: "default" | "danger";
  chevron?: boolean;
  testID?: string;
}) {
  const icons = useIconColors();
  const danger = tone === "danger";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={description ? `${title}. ${description}` : title}
      onPress={onPress}
      className="min-h-[64px] flex-row items-center gap-3.5 px-4 py-3.5 data-[hover=true]:bg-wash2"
    >
      <Box
        aria-hidden
        className={`h-9 w-9 items-center justify-center rounded-[9px] ${danger ? "bg-err-wash" : "bg-primary-wash"}`}
      >
        <Icon size={18} color={danger ? icons.destructive : icons.primary} />
      </Box>
      <Box className="min-w-0 flex-1">
        <Text className={type.itemTitle}>{title}</Text>
        {description ? <Text className={`${type.meta} mt-0.5`}>{description}</Text> : null}
      </Box>
      {chevron ? <ChevronRight size={18} color={icons.faint} /> : null}
    </Pressable>
  );
}

/** A card holding rows divided by hairlines. */
export function SettingsRowCard({ children, testID }: { children?: React.ReactNode; testID?: string }) {
  const rows = React.Children.toArray(children);
  return (
    <Box testID={testID} className="w-full overflow-hidden rounded-card bg-surface shadow-card">
      {rows.map((row, index) => (
        <React.Fragment key={(React.isValidElement(row) && row.key) || index}>
          {index > 0 ? <Box aria-hidden className="h-px bg-line" /> : null}
          {row}
        </React.Fragment>
      ))}
    </Box>
  );
}

export function SettingsStartList({
  items,
  onOpen,
  testID = "settings-start-list",
}: {
  items: readonly SettingsNavItem[];
  onOpen: (item: SettingsNavItem) => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  return (
    <SettingsRowCard testID={testID}>
      {items.map((item) => {
        const keys = settingsItemKeys(item.key);
        return (
          <SettingsStartRow
            key={item.key}
            testID={`settings-start-${item.key}`}
            icon={item.icon}
            title={t(keys.title)}
            description={t(keys.description)}
            onPress={() => onOpen(item)}
          />
        );
      })}
    </SettingsRowCard>
  );
}
