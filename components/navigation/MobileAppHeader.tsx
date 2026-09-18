// components/navigation/MobileAppHeader.tsx
import { Bell } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { isWeb } from "@/lib/platform";
import { useIconColors } from "@/lib/theme/icon-colors";
import { TAP_TARGET_ICON_BOX } from "@/lib/ui/tap-target";

// Fixed on-navy ink for icons on this always-navy header, matching AppSidebar.
const ON_DARK_ICON = "#ffffff";

type MobileAppHeaderProps = {
  userName?: string;
  userRole?: string;
  companyName?: string;
  unreadCount: number;
  onOpenNotifications: () => void;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function MobileAppHeader({
  userName,
  companyName,
  unreadCount,
  onOpenNotifications,
}: MobileAppHeaderProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const displayName = companyName?.trim() || userName?.trim() || "InvoHub";
  // The avatar monogram is always derived from the signed-in USER's name,
  // never the company's — two entrepreneurs at the same company must see
  // their own initials, not "InvoHub Demo"'s (M3 fix).
  const monogramSource = userName?.trim() || displayName;

  return (
    <Box className="bg-secondary px-4 py-3">
      <HStack className="items-center justify-between">
        <HStack space="sm" className="flex-1 items-center">
          <Box className="h-9 w-9 items-center justify-center rounded-full bg-secondary-foreground/15">
            <Text className="text-xs font-bold text-white">
              {initials(monogramSource)}
            </Text>
          </Box>
          <VStack className="flex-1">
            <Text
              className="font-semibold text-white"
              isTruncated
              {...(isWeb() ? {} : { numberOfLines: 1 })}
            >
              {displayName}
            </Text>
            {userName && companyName ? (
              <Text size="xs" className="text-secondary-foreground/70">
                {userName}
              </Text>
            ) : null}
          </VStack>
        </HStack>

        <HStack space="sm" className="items-center">
          <Pressable
            onPress={onOpenNotifications}
            className={`relative rounded-full ${TAP_TARGET_ICON_BOX}`}
            hitSlop={8}
            accessibilityLabel={
              unreadCount > 0 ? t("nav.notificationsUnread", { count: unreadCount }) : t("nav.notifications")
            }
          >
            <Bell size={22} color={ON_DARK_ICON} />
            {unreadCount > 0 ? (
              // Offset INSIDE the enlarged 44px box (not the box corner) so
              // the badge stays visually attached to the bell glyph instead
              // of drifting to the far corner of the bigger tap target.
              <Box className="absolute right-1.5 top-1.5 min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 py-0.5">
                <Text size="xs" className="font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </Box>
            ) : null}
          </Pressable>
          <LanguageSwitcher tone="onDark" />
        </HStack>
      </HStack>
    </Box>
  );
}
