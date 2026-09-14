// components/layout/DangerZone.tsx
// A visually distinct, collapsed-by-default zone for destructive actions
// (Storno, Törlés) — so a destructive action never sits in the same row as
// a neutral one (D1). Collapsed by default; expands on tap.
import { useState } from "react";
import { ChevronDown, ChevronRight, TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useIconColors } from "@/lib/theme/icon-colors";

export type DangerZoneProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function DangerZone({ title, description, children }: DangerZoneProps) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const icons = useIconColors();

  return (
    <Box
      testID="danger-zone"
      className="rounded-xl border border-destructive/40 bg-card p-4"
    >
      <Pressable
        testID="danger-zone-toggle"
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? t("common.collapse") : t("common.expand")}
      >
        <HStack className="items-center justify-between gap-3">
          <HStack space="sm" className="items-center flex-1">
            <TriangleAlert size={16} color={icons.destructive} />
            <VStack className="flex-1">
              <Text size="sm" className="font-medium text-destructive">
                {title}
              </Text>
              <Text size="xs" className="text-muted-foreground">
                {description}
              </Text>
            </VStack>
          </HStack>
          {expanded ? (
            <ChevronDown size={18} color={icons.muted} />
          ) : (
            <ChevronRight size={18} color={icons.muted} />
          )}
        </HStack>
      </Pressable>
      {expanded ? (
        <Box testID="danger-zone-content" className="mt-4">
          {children}
        </Box>
      ) : null}
    </Box>
  );
}
