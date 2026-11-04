// components/navigation/SheetRow.tsx
// One 52px row of a phone sheet (Új, Továbbiak): 22px muted icon, 14/500 label
// (tokens.md §6.13).
import type { ComponentType } from "react";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useIconColors } from "@/lib/theme/icon-colors";

export function SheetRow({
  label,
  icon: Icon,
  onPress,
  testID,
  destructive = false,
}: {
  label: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
  testID?: string;
  destructive?: boolean;
}) {
  const icons = useIconColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-[52px] flex-row items-center gap-3.5 rounded-control px-1 data-[hover=true]:bg-neutral-wash"
    >
      <Icon size={22} color={destructive ? icons.destructive : icons.muted} />
      <Text className={`text-sm font-medium ${destructive ? "text-err" : "text-ink"}`}>{label}</Text>
    </Pressable>
  );
}
