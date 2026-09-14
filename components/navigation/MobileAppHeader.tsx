// components/navigation/MobileAppHeader.tsx
import { Bell } from "lucide-react-native";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useIconColors } from "@/lib/theme/icon-colors";

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
  const icons = useIconColors();
  const displayName = companyName?.trim() || userName?.trim() || "InvoHub";

  return (
    <Box className="bg-secondary px-4 py-3">
      <HStack className="items-center justify-between">
        <HStack space="sm" className="flex-1 items-center">
          <Box className="h-9 w-9 items-center justify-center rounded-full bg-[#1f305e]">
            <Text className="text-xs font-bold text-white">
              {initials(displayName)}
            </Text>
          </Box>
          <VStack className="flex-1">
            <Text className="font-semibold text-white" numberOfLines={1}>
              {displayName}
            </Text>
            {userName && companyName ? (
              <Text size="xs" className="text-[#c5c7ca]">
                {userName}
              </Text>
            ) : null}
          </VStack>
        </HStack>

        <HStack space="sm" className="items-center">
          <Pressable
            onPress={onOpenNotifications}
            className="relative rounded-full p-2.5"
            accessibilityLabel="Notifications"
          >
            <Bell size={22} color="#f9f9f9" />
            {unreadCount > 0 ? (
              <Box className="absolute -right-0.5 -top-0.5 min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 py-0.5">
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
