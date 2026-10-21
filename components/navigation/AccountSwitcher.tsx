// components/navigation/AccountSwitcher.tsx
// "Which billing account am I working in?" — shown in the top strip. Lists the
// person's own account and every workspace they own or were invited to, plus
// shortcuts to create one / manage access.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Briefcase, Check, ChevronDown, Plus, Users } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useIconColors } from "@/lib/theme/icon-colors";
import type { UseWorkspaces } from "@/hooks/useWorkspaces";

export function AccountSwitcher({
  workspaces,
  onManage,
}: {
  workspaces: Pick<UseWorkspaces, "accounts" | "active" | "switchTo">;
  /** Opens settings → Számlázófiókok és hozzáférés. */
  onManage: () => void;
}) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const [open, setOpen] = React.useState(false);
  const { accounts, active, switchTo } = workspaces;
  if (!active) return null;

  const close = () => setOpen(false);

  return (
    <Box className="relative" testID="account-switcher">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={t("accounts.switchLabel")}
        accessibilityState={{ expanded: open }}
        testID="account-switcher-button"
        className="h-9 max-w-[220px] flex-row items-center gap-2 rounded-lg border border-border px-3 hover:bg-muted"
      >
        <Briefcase size={15} color={icons.muted} />
        <Text className="flex-shrink text-sm font-medium text-foreground" numberOfLines={1}>
          {active.name}
        </Text>
        <ChevronDown size={14} color={icons.muted} />
      </Pressable>

      {open ? (
        <>
          <Pressable onPress={close} accessibilityLabel={t("nav.menu")} className="absolute -inset-[1000px] z-10" />
          <VStack className="absolute right-0 top-11 z-20 w-72 gap-0.5 rounded-xl border border-border bg-popover p-1.5 shadow-sm">
            <Text className="px-2.5 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("accounts.title")}
            </Text>
            {accounts.map((account) => (
              <Pressable
                key={account.id}
                onPress={() => {
                  close();
                  if (account.id !== active.id) switchTo(account.isOwn ? null : account.id);
                }}
                accessibilityRole="menuitem"
                testID={`account-option-${account.id}`}
                className="flex-row items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-muted"
              >
                <Box className="w-4">{account.id === active.id ? <Check size={14} color={icons.primary} /> : null}</Box>
                <VStack className="flex-1">
                  <Text className="text-sm text-popover-foreground" numberOfLines={1}>
                    {account.name}
                  </Text>
                  <Text size="xs" className="text-muted-foreground">
                    {account.isOwn ? t("accounts.own") : t(`accounts.roles.${account.role}`)}
                  </Text>
                </VStack>
              </Pressable>
            ))}
            <Box className="my-1 h-px bg-border" />
            <Pressable
              onPress={() => {
                close();
                onManage();
              }}
              accessibilityRole="menuitem"
              testID="account-manage"
              className="flex-row items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-muted"
            >
              <Plus size={15} color={icons.muted} />
              <Text className="text-sm text-popover-foreground">{t("accounts.newAccount")}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                close();
                onManage();
              }}
              accessibilityRole="menuitem"
              className="flex-row items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-muted"
            >
              <Users size={15} color={icons.muted} />
              <Text className="text-sm text-popover-foreground">{t("accounts.manageAccess")}</Text>
            </Pressable>
          </VStack>
        </>
      ) : null}
    </Box>
  );
}
