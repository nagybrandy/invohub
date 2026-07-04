// components/layout/FeatureLinkCard.tsx
// Tappable feature tile for dashboard / settings hubs.
import type { LucideIcon } from "lucide-react-native";
import { ChevronRight } from "lucide-react-native";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useIconColors } from "@/lib/theme/icon-colors";

type FeatureLinkCardProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  onPress: () => void;
};

export function FeatureLinkCard({
  icon: Icon,
  title,
  description,
  onPress,
}: FeatureLinkCardProps) {
  const icons = useIconColors();

  return (
    <Pressable onPress={onPress} className="min-w-[45%] flex-1">
      <Card className="h-full p-4 active:opacity-80">
        <HStack className="items-start justify-between">
          <VStack space="xs" className="flex-1 pr-2">
            <HStack space="sm" className="items-center">
              <Icon size={20} color={icons.accent} />
              <Text className="font-semibold text-foreground">{title}</Text>
            </HStack>
            {description ? (
              <Text size="xs" className="text-muted-foreground">
                {description}
              </Text>
            ) : null}
          </VStack>
          <ChevronRight size={16} color={icons.muted} />
        </HStack>
      </Card>
    </Pressable>
  );
}
