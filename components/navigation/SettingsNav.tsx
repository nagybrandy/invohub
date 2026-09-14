// components/navigation/SettingsNav.tsx
// One-click way back to the Settings hub from every /settings/* subpage
// (N8/N9 fix) — subpages previously had no way back except the browser's
// back button or retyping the URL.
import { ChevronLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";

export function SettingsNav() {
  const { t } = useTranslation();
  const icons = useIconColors();

  return (
    <Pressable
      onPress={() => router.push(routes.settings)}
      accessibilityRole="link"
      accessibilityLabel={t("settings.backToHub")}
      className="mb-2 self-start rounded-lg py-1 pr-2 hover:bg-muted"
    >
      <HStack space="xs" className="items-center">
        <ChevronLeft size={16} color={icons.muted} />
        <Text size="sm" className="text-muted-foreground">
          {t("settings.backToHub")}
        </Text>
      </HStack>
    </Pressable>
  );
}
