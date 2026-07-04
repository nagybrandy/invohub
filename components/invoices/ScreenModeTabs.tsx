// components/invoices/ScreenModeTabs.tsx
// Top-level Edit / Preview switch for invoice forms.
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

export type ScreenMode = "edit" | "preview";

export function ScreenModeTabs({
  mode,
  onChange,
}: {
  mode: ScreenMode;
  onChange: (mode: ScreenMode) => void;
}) {
  return (
    <HStack className="rounded-lg border border-border bg-muted p-1">
      {(["edit", "preview"] as ScreenMode[]).map((value) => (
        <Pressable
          key={value}
          onPress={() => onChange(value)}
          className={`flex-1 rounded-md px-4 py-2 ${
            mode === value ? "bg-background shadow-sm" : ""
          }`}
        >
          <Text
            size="sm"
            className={`text-center font-medium capitalize ${
              mode === value ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {value}
          </Text>
        </Pressable>
      ))}
    </HStack>
  );
}
