// components/navigation/AccountMenu.tsx
// The account button plus its menu (SPEC §5.5, tokens.md §6.10). One
// component for both breakpoints: a popover above the sidebar footer button
// on desktop, a bottom sheet from the phone header button. Content:
//   Bejelentkezve + the signed-in user
//   Cégeid: the REAL billing accounts (check on the active one, click switches)
//   Számlázófiókok kezelése -> Settings > Számlázófiókok és hozzáférés
//   Cégadatok szerkesztése
//   Kijelentkezés (last) -> the shell's logout confirm
// Replaces UserMenu and the top-strip AccountSwitcher.
import * as React from "react";
import { useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronsUpDown, LogOut, Users } from "lucide-react-native";
import { AnchoredPopover, MENU_PANEL_CLASS } from "@/components/layout/AnchoredPopover";
import { AccountAvatar } from "@/components/navigation/AccountAvatar";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useMenuKeyboard } from "@/components/ui/menu/use-menu-keyboard";
import { LAYOUT } from "@/lib/theme/layout";
import { useIconColors } from "@/lib/theme/icon-colors";

export type AccountMenuAccount = {
  id: string;
  name: string;
  isOwn: boolean;
  role: string;
  active: boolean;
};

export type AccountMenuProps = {
  /** sidebar: footer button on navy (desktop). header: bordered button in the phone top bar. */
  variant: "sidebar" | "header";
  /** Sidebar rail: avatar only. */
  collapsed?: boolean;
  user?: { name?: string; email?: string };
  /** The active account's company (name + tax number show on the button). */
  company?: { name?: string; taxNumber?: string };
  accounts: AccountMenuAccount[];
  /** Switch to an account; `null` means the person's own account. */
  onSwitch: (accountId: string | null) => void;
  onManage: () => void;
  onEditCompany: () => void;
  /** Opens the logout confirm (the shell owns it). */
  onSignOut: () => void;
  testID?: string;
};

const ROW =
  "min-h-11 flex-row items-center gap-3 rounded-control px-2.5 py-2 data-[hover=true]:bg-neutral-wash";

function MenuBody({
  user,
  company,
  accounts,
  onSwitch,
  onManage,
  onEditCompany,
  onSignOut,
}: Pick<AccountMenuProps, "user" | "company" | "accounts" | "onSwitch" | "onManage" | "onEditCompany" | "onSignOut">) {
  const { t } = useTranslation();
  const icons = useIconColors();
  // Mounted only while the menu is open: focus lands on the first row, then
  // ArrowUp/Down/Home/End move between rows.
  const keyboard = useMenuKeyboard();
  return (
    <Box
      ref={keyboard.ref as never}
      // @ts-expect-error — onKeyDown is a web-only DOM prop on RN-web views.
      onKeyDown={keyboard.onKeyDown}
      accessibilityRole="menu"
      testID="account-menu"
      className="gap-0.5"
    >
      <Text className="px-2.5 pb-1 pt-1.5 text-xs text-muted-ink">{t("shell.account.signedIn")}</Text>
      <Box className="flex-row items-center gap-3 px-2.5 pb-2.5 pt-1">
        <AccountAvatar id="user" name={user?.name} round size={32} />
        <Box className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-sm font-semibold text-ink">
            {user?.name || "—"}
          </Text>
          {user?.email ? (
            <Text numberOfLines={1} className="text-xs text-muted-ink">
              {user.email}
            </Text>
          ) : null}
        </Box>
      </Box>
      <Box className="my-1 h-px bg-line" />
      <Text className="px-2.5 pb-1 pt-1.5 text-xs text-muted-ink">{t("shell.account.companies")}</Text>
      {accounts.map((account) => (
        <Pressable
          key={account.id}
          testID={`account-option-${account.id}`}
          accessibilityRole="menuitem"
          accessibilityState={{ selected: account.active }}
          onPress={() => {
            if (!account.active) onSwitch(account.isOwn ? null : account.id);
          }}
          className={`${ROW} ${account.active ? "bg-primary-wash" : ""}`}
        >
          <AccountAvatar id={account.id} name={account.name} active={account.active} />
          <Box className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-sm font-semibold text-ink">
              {account.active && company?.name ? company.name : account.name}
            </Text>
            <Text numberOfLines={1} className="text-xs text-muted-ink">
              {account.active && company?.taxNumber
                ? company.taxNumber
                : account.isOwn
                  ? t("accounts.own")
                  : t(`accounts.roles.${account.role}`)}
            </Text>
          </Box>
          {account.active ? <Check size={16} color={icons.primary} /> : null}
        </Pressable>
      ))}
      <Box className="my-1 h-px bg-line" />
      <Pressable
        testID="account-manage"
        accessibilityRole="menuitem"
        onPress={onManage}
        className={ROW}
      >
        <Users size={16} color={icons.muted} />
        <Text className="text-sm font-medium text-ink">{t("shell.account.manage")}</Text>
      </Pressable>
      <Pressable
        testID="account-edit-company"
        accessibilityRole="menuitem"
        onPress={onEditCompany}
        className={ROW}
      >
        <Text className="text-sm font-semibold text-primary-ink">{t("shell.account.editCompany")}</Text>
      </Pressable>
      <Box className="my-1 h-px bg-line" />
      <Pressable
        testID="account-sign-out"
        accessibilityRole="menuitem"
        onPress={onSignOut}
        className={ROW}
      >
        <LogOut size={16} color={icons.foreground} />
        <Text className="text-sm font-medium text-ink">{t("shell.account.signOut")}</Text>
      </Pressable>
    </Box>
  );
}

export function AccountMenu({
  variant,
  collapsed = false,
  user,
  company,
  accounts,
  onSwitch,
  onManage,
  onEditCompany,
  onSignOut,
  testID = "account-button",
}: AccountMenuProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const { width } = useWindowDimensions();
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<{ focus?: () => void } | null>(null);
  const asSheet = width <= LAYOUT.phoneMax;

  const active = accounts.find((account) => account.active);
  const displayName = company?.name?.trim() || active?.name || t("shell.account.noCompany");
  const avatarId = active?.id ?? "own";

  const close = React.useCallback(() => setOpen(false), []);
  const focusTrigger = React.useCallback(() => triggerRef.current?.focus?.(), []);
  // Every choice closes the menu first; sign-out also parks focus on the
  // trigger so the logout dialog (opened next) restores focus to it.
  const choose = (action: () => void, returnFocus = false) => () => {
    close();
    if (returnFocus) focusTrigger();
    action();
  };

  const trigger =
    variant === "sidebar" ? (
      <Pressable
        ref={triggerRef as never}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? `${displayName}. ${t("shell.account.button")}` : t("shell.account.button")}
        accessibilityState={{ expanded: open }}
        aria-haspopup="menu"
        onPress={() => setOpen((v) => !v)}
        className={`flex-row items-center gap-2.5 rounded-menu border border-white/[0.12] bg-white/[0.06] ${
          collapsed ? "mx-auto h-11 w-11 justify-center" : "px-2.5 py-2"
        } data-[hover=true]:bg-white/[0.11]`}
      >
        <AccountAvatar id={avatarId} name={displayName} active />
        {collapsed ? null : (
          <>
            <Box className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-sm font-semibold text-white">
                {displayName}
              </Text>
              {company?.taxNumber ? (
                <Text numberOfLines={1} className="text-xs text-navy-ink/80">
                  {company.taxNumber}
                </Text>
              ) : null}
            </Box>
            <ChevronsUpDown size={16} color={icons.onNavy} />
          </>
        )}
      </Pressable>
    ) : (
      <Pressable
        ref={triggerRef as never}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${displayName}. ${t("shell.account.button")}`}
        accessibilityState={{ expanded: open }}
        aria-haspopup="menu"
        onPress={() => setOpen((v) => !v)}
        className={`h-[42px] max-w-[230px] flex-row items-center gap-2 rounded-menu border bg-surface py-1 pl-1.5 pr-2.5 ${
          open ? "border-primary" : "border-line"
        }`}
      >
        <AccountAvatar id={avatarId} name={displayName} active />
        <Text numberOfLines={1} className="flex-shrink text-sm font-semibold text-ink">
          {displayName}
        </Text>
        <ChevronDown size={16} color={icons.muted} />
      </Pressable>
    );

  const body = (
    <MenuBody
      user={user}
      company={company}
      accounts={accounts}
      onSwitch={(id) => {
        close();
        onSwitch(id);
      }}
      onManage={choose(onManage)}
      onEditCompany={choose(onEditCompany)}
      onSignOut={choose(onSignOut, true)}
    />
  );

  if (asSheet) {
    return (
      <>
        {trigger}
        <Sheet open={open} onClose={close} title={t("shell.account.menuTitle")} testID="account-sheet">
          {body}
        </Sheet>
      </>
    );
  }

  return (
    <AnchoredPopover
      open={open}
      onClose={close}
      onEscape={focusTrigger}
      anchor={trigger}
      anchorClassName="flex w-full"
      align="left"
      width={272}
      placement="above"
      role="menu"
      panelClassName={MENU_PANEL_CLASS}
      testID="account-popover"
    >
      {body}
    </AnchoredPopover>
  );
}
