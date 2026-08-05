// components/invoices/ScreenModeTabs.tsx
import { useTranslation } from "react-i18next";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

export type ScreenMode = "edit" | "preview";

const MODE_I18N: Record<ScreenMode, string> = {
  edit: "invoices.screenModes.edit",
  preview: "invoices.screenModes.preview",
};

export function ScreenModeTabs({
  mode,
  onChange,
}: {
  mode: ScreenMode;
  onChange: (mode: ScreenMode) => void;
}) {
  const { t } = useTranslation();
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
            className={`text-center font-medium ${
              mode === value ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {t(MODE_I18N[value])}
          </Text>
        </Pressable>
      ))}
    </HStack>
  );
}
