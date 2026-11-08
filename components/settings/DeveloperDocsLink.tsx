// components/settings/DeveloperDocsLink.tsx
// Link from the API keys settings page to the public developer docs.
import { router } from "expo-router";
import { ExternalLink } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { routes } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";

export function DeveloperDocsLink() {
  const { t } = useTranslation();
  const icons = useIconColors();

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(routes.developers)}
      className="min-h-10 flex-row items-center gap-2 self-start rounded-control web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
      testID="api-keys-docs-link"
    >
      <Text className="text-sm font-medium text-primary">
        {t("settingsPages.apiKeys.developerDocsLink")}
      </Text>
      <ExternalLink size={16} color={icons.primary} />
    </Pressable>
  );
}
