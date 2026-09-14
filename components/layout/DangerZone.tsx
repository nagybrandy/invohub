// components/layout/DangerZone.tsx
// Collapsed-by-default destructive-actions area (Sztornó / Törlés) so a
// destructive action never sits in the same row as a neutral one (D1).
import * as React from "react";
import { ChevronDown, ChevronRight, TriangleAlert } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useIconColors } from "@/lib/theme/icon-colors";

type DangerZoneProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function DangerZone({ title, description, children }: DangerZoneProps) {
  const [open, setOpen] = React.useState(false);
  const icons = useIconColors();

  return (
    <Box className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <Pressable
        testID="danger-zone-toggle"
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between"
        accessibilityRole="button"
      >
        <HStack space="sm" className="flex-1 items-center">
          <TriangleAlert size={16} color={icons.destructive} />
          <VStack>
            <Text className="font-semibold text-destructive">{title}</Text>
            <Text size="xs" className="text-destructive/80">
              {description}
            </Text>
          </VStack>
        </HStack>
        {open ? (
          <ChevronDown size={18} color={icons.destructive} />
        ) : (
          <ChevronRight size={18} color={icons.destructive} />
        )}
      </Pressable>
      {open ? (
        <Box className="mt-3" testID="danger-zone-content">
          {children}
        </Box>
      ) : null}
    </Box>
  );
}
