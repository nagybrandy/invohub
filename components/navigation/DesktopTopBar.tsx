// components/navigation/DesktopTopBar.tsx
// Desktop content header with notifications access.
import { Bell } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useIconColors } from "@/lib/theme/icon-colors";

type DesktopTopBarProps = {
  unreadCount: number;
  onOpenNotifications: () => void;
};

export function DesktopTopBar({ unreadCount, onOpenNotifications }: DesktopTopBarProps) {
  const icons = useIconColors();

  return (
    <Box className="border-b border-border bg-card px-6 py-2">
      <HStack className="items-center justify-end">
        <Pressable
          onPress={onOpenNotifications}
          className="relative rounded-lg px-3 py-2 active:bg-muted"
        >
          <HStack space="sm" className="items-center">
            <Bell size={20} color={icons.primary} />
            <Text size="sm" className="text-muted-foreground">
              Notifications
            </Text>
            {unreadCount > 0 ? (
              <Box className="min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 py-0.5">
                <Text size="xs" className="font-bold text-destructive-foreground">
                  {unreadCount}
                </Text>
              </Box>
            ) : null}
          </HStack>
        </Pressable>
      </HStack>
    </Box>
  );
}
