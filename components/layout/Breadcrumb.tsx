// components/layout/Breadcrumb.tsx
// Breadcrumb trail (SPEC §5.6). Sits inside PageHeader above the title, only
// on subpages: 14px muted text, `--faint` chevron separators, the current
// item in `--ink` 500. On phones the trail collapses to one "‹ Parent" back
// link (tokens.md §6.18).
import { router } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useWindowDimensions } from "react-native";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { LAYOUT } from "@/lib/theme/layout";
import { useIconColors } from "@/lib/theme/icon-colors";
import type { Href } from "expo-router";

export type BreadcrumbItem = {
  label: string;
  href?: Href;
};

type Props = {
  items: BreadcrumbItem[];
};

/** The item the phone back link points at: the nearest ancestor that has a href. */
export function parentBreadcrumb(items: BreadcrumbItem[]): BreadcrumbItem | undefined {
  for (let i = items.length - 2; i >= 0; i -= 1) {
    if (items[i].href) return items[i];
  }
  return undefined;
}

export function Breadcrumb({ items }: Props) {
  const icons = useIconColors();
  const { width } = useWindowDimensions();

  if (width <= LAYOUT.phoneMax) {
    const parent = parentBreadcrumb(items);
    if (!parent) return null;
    return (
      <Pressable
        testID="breadcrumb-back"
        accessibilityRole="link"
        accessibilityLabel={parent.label}
        onPress={() => router.push(parent.href!)}
        className="min-h-10 flex-row items-center gap-1 self-start"
      >
        <ChevronLeft size={16} color={icons.muted} />
        <Text className="text-sm text-muted-ink">{parent.label}</Text>
      </Pressable>
    );
  }

  return (
    <HStack className="items-center" space="xs" role="navigation" testID="breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <HStack key={`${item.label}-${index}`} className="items-center" space="xs">
            {index > 0 && <ChevronRight size={14} color={icons.faint} />}
            {item.href && !isLast ? (
              <Pressable accessibilityRole="link" onPress={() => router.push(item.href!)}>
                <Text className="text-sm text-muted-ink data-[hover=true]:text-ink">{item.label}</Text>
              </Pressable>
            ) : (
              <Text
                accessibilityRole={isLast ? "text" : undefined}
                aria-current={isLast ? "page" : undefined}
                className={`text-sm ${isLast ? "font-medium text-ink" : "text-muted-ink"}`}
              >
                {item.label}
              </Text>
            )}
          </HStack>
        );
      })}
    </HStack>
  );
}
