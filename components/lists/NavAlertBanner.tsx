// components/lists/NavAlertBanner.tsx
// "N számla NAV-hibás. Javítsd, mielőtt a határidő lejár." on an err-wash band
// with a small "Megnézem" button that filters the list to the failed ones.
// Rendered by the screen only when useNavFailedCount() > 0.
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export function NavAlertBanner({ count, onShow }: { count: number; onShow: () => void }) {
  const { t } = useTranslation();
  if (count <= 0) return null;
  return (
    <Box
      testID="nav-alert-banner"
      accessibilityRole="alert"
      className="w-full flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-card bg-err-wash px-3.5 py-2.5"
    >
      <Text className="min-w-0 flex-1 text-sm text-err">
        <Text className="text-sm font-semibold text-err">{t("lists.navAlert.count", { count })} </Text>
        {t("lists.navAlert.hint")}
      </Text>
      <Button size="sm" variant="secondary" testID="nav-alert-show" onPress={onShow}>
        <ButtonText>{t("lists.navAlert.show")}</ButtonText>
      </Button>
    </Box>
  );
}
