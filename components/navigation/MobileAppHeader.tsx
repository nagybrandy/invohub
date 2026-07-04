// components/navigation/MobileAppHeader.tsx
// Mobile top bar: logged-in user name + notification bell.
import { Bell } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useIconColors } from "@/lib/theme/icon-colors";
import { roleLabel } from "@/lib/user-roles";

type MobileAppHeaderProps = {
  userName?: string;
  userRole?: string;
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
  userRole,
  unreadCount,
  onOpenNotifications,
}: MobileAppHeaderProps) {
  const icons = useIconColors();
  const displayName = userName?.trim() || "Signed in";

  return (
    <Box className="border-b border-border bg-card px-4 py-3">
      <HStack className="items-center justify-between">
        <HStack space="sm" className="flex-1 items-center">
          <Box className="h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Text className="text-sm font-bold text-primary-foreground">
              {initials(displayName)}
            </Text>
          </Box>
          <VStack className="flex-1">
            <Text className="font-semibold text-foreground" numberOfLines={1}>
              {displayName}
            </Text>
            {userRole ? (
              <Text size="xs" className="text-muted-foreground">
                {roleLabel(userRole)}
              </Text>
            ) : null}
          </VStack>
        </HStack>

        <Pressable
          onPress={onOpenNotifications}
          className="relative rounded-full p-2.5 active:bg-muted"
          accessibilityLabel="Notifications"
        >
          <Bell size={22} color={icons.primary} />
          {unreadCount > 0 ? (
            <Box className="absolute -right-0.5 -top-0.5 min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 py-0.5">
              <Text size="xs" className="font-bold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </Box>
          ) : null}
        </Pressable>
      </HStack>
    </Box>
  );
}
