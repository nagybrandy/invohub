import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useIconColors } from "@/lib/theme/icon-colors";
import type { Href } from "expo-router";

export type BreadcrumbItem = {
  label: string;
  href?: Href;
};

type Props = {
  items: BreadcrumbItem[];
};

export function Breadcrumb({ items }: Props) {
  const icons = useIconColors();

  return (
    <HStack className="items-center" space="xs">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <HStack key={`${item.label}-${index}`} className="items-center" space="xs">
            {index > 0 && <ChevronRight size={14} color={icons.muted} />}
            {item.href && !isLast ? (
              <Pressable onPress={() => router.push(item.href!)}>
                <Text className="text-sm text-muted-foreground">{item.label}</Text>
              </Pressable>
            ) : (
              <Text className={`text-sm ${isLast ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {item.label}
              </Text>
            )}
          </HStack>
        );
      })}
    </HStack>
  );
}
