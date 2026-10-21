// components/navigation/ForeignAccountBanner.tsx
// A strip above the content whenever the person is working in an account that
// is not their own — it must be impossible to issue an invoice in the wrong
// company without noticing.
import { useTranslation } from "react-i18next";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import type { WorkspaceRole } from "@/lib/workspaces/permissions";

export function ForeignAccountBanner({
  accountName,
  role,
  onBack,
}: {
  accountName: string;
  role: WorkspaceRole;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <HStack className="items-center justify-between gap-3 bg-amber-100 px-4 py-2" testID="foreign-account-banner">
      <Text size="sm" className="flex-1 text-amber-950">
        {t("accounts.workingIn", { name: accountName, role: t(`accounts.roles.${role}`) })}
        {role === "viewer" ? ` ${t("accounts.readOnly")}` : ""}
      </Text>
      <Pressable onPress={onBack} accessibilityRole="button" testID="foreign-account-back">
        <Text size="sm" className="font-semibold text-amber-950 underline">
          {t("accounts.backToOwn")}
        </Text>
      </Pressable>
    </HStack>
  );
}
