// components/navigation/AppShell.tsx
// The signed-in app's chrome (redesign 2026-11, SPEC §5):
//   > 700px  navy sidebar (248 / 72 rail) + 56px top bar (search + bell)
//   <= 700px 56px header (account button, search, bell) + bottom tab bar with
//            the Új and Továbbiak sheets
// Plus the account menu, the logout confirm and the notification panel. The
// shell only opens and closes the notification panel (the home track restyles
// it); NotificationBanner is no longer rendered here: the bell badge replaces it.
import * as React from "react";
import { useWindowDimensions } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { AccountMenu, type AccountMenuAccount } from "@/components/navigation/AccountMenu";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { AppTopStrip } from "@/components/navigation/AppTopStrip";
import { ForeignAccountBanner } from "@/components/navigation/ForeignAccountBanner";
import { LogoutConfirm, useLogoutConfirm } from "@/components/navigation/LogoutConfirm";
import { MobileAppHeader } from "@/components/navigation/MobileAppHeader";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";
import { MoreSheet } from "@/components/navigation/MoreSheet";
import { NewSheet } from "@/components/navigation/NewSheet";
import { useSidebarCollapsed } from "@/components/navigation/useSidebarCollapsed";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { signOut, useSession } from "@/lib/auth-client";
import { routes, type AppRoute } from "@/lib/navigation";
import { takePendingInvite } from "@/lib/workspaces/pending-invite";
import { DESKTOP_BREAKPOINT } from "@/lib/useIsDesktop";
import { useNotifications } from "@/hooks/useNotifications";
import { useCompany } from "@/hooks/useCompany";
import { useWorkspaces } from "@/hooks/useWorkspaces";

export type AppShellProps = {
  /** Test-only override for the measured window width, so the desktop/
   * phone breakpoint is testable without mocking react-native's Dimensions
   * module (matches the pattern used by AppSidebar). */
  viewportWidthForTest?: number;
};

export function AppShell({ viewportWidthForTest }: AppShellProps = {}) {
  const { width: measuredWidth } = useWindowDimensions();
  const width = viewportWidthForTest ?? measuredWidth;
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const { company } = useCompany();
  const workspaces = useWorkspaces();

  // An invitation link was opened while signed out: finish it now that we are in.
  React.useEffect(() => {
    if (!session) return;
    const pending = takePendingInvite();
    if (pending) router.replace({ pathname: "/invite", params: { token: pending } } as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const { collapsed, toggleCollapsed } = useSidebarCollapsed(width);

  const { notifications, unreadCount, loading: notificationsLoading, markRead, markAllRead, sync } =
    useNotifications({ syncOnMount: true });

  function navigate(href: AppRoute) {
    router.push(href);
  }

  const handleSignOut = React.useCallback(async () => {
    await signOut();
    router.replace(routes.login);
  }, [router]);
  const logout = useLogoutConfirm(handleSignOut);

  const accounts: AccountMenuAccount[] = React.useMemo(() => {
    if (workspaces.accounts.length > 0) {
      return workspaces.accounts.map((account) => ({
        id: account.id,
        name: account.name,
        isOwn: account.isOwn,
        role: account.role,
        active: workspaces.active?.id === account.id,
      }));
    }
    // Accounts not loaded (yet): show the person's own company as the one entry.
    const user = session?.user;
    return user
      ? [{ id: user.id, name: company?.name || user.name || "", isOwn: true, role: "owner", active: true }]
      : [];
  }, [workspaces.accounts, workspaces.active?.id, session?.user, company?.name]);

  function accountMenu(variant: "sidebar" | "header") {
    return (
      <AccountMenu
        variant={variant}
        collapsed={variant === "sidebar" && collapsed}
        user={{ name: session?.user?.name, email: session?.user?.email }}
        company={{ name: company?.name, taxNumber: company?.taxNumber ?? undefined }}
        accounts={accounts}
        onSwitch={(id) => workspaces.switchTo(id)}
        onManage={() => router.push(routes.settingsAccess)}
        onEditCompany={() => router.push(routes.settingsCompany)}
        onSignOut={logout.request}
        testID={variant === "sidebar" ? "sidebar-account-button" : "header-account-button"}
      />
    );
  }

  const foreignBanner =
    workspaces.inForeignAccount && workspaces.active ? (
      <ForeignAccountBanner
        accountName={workspaces.active.name}
        role={workspaces.role}
        onBack={() => workspaces.switchTo(null)}
      />
    ) : null;

  const overlays = (
    <>
      <NotificationPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        loading={notificationsLoading}
        onMarkRead={(id) => void markRead(id)}
        onMarkAllRead={() => void markAllRead()}
        onSync={() => void sync()}
      />
      <LogoutConfirm
        open={logout.open}
        busy={logout.busy}
        onCancel={logout.cancel}
        onConfirm={() => void logout.confirm()}
      />
    </>
  );

  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <HStack className="flex-1">
          <AppSidebar
            activePathname={pathname}
            role={userRole}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            onNavigate={navigate}
            onNewInvoice={() => router.push(routes.newInvoice)}
            onNewReceipt={() => router.push(routes.newReceipt)}
            onNewPartner={() => router.push(routes.newClient)}
            accountMenu={accountMenu("sidebar")}
          />
          <VStack className="min-w-0 flex-1">
            <AppTopStrip
              unreadCount={unreadCount}
              onOpenNotifications={() => setPanelOpen(true)}
              notificationsOpen={panelOpen}
            />
            {foreignBanner}
            <Box className="flex-1">
              <Slot />
            </Box>
          </VStack>
        </HStack>
        {overlays}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "left", "right"]}>
      <MobileAppHeader
        accountMenu={accountMenu("header")}
        unreadCount={unreadCount}
        onOpenNotifications={() => setPanelOpen(true)}
        notificationsOpen={panelOpen}
      />
      {foreignBanner}
      <Box className="flex-1">
        <Slot />
      </Box>
      <MobileTabBar
        pathname={pathname}
        onNavigate={navigate}
        onOpenNew={() => setNewOpen(true)}
        onOpenMore={() => setMoreOpen(true)}
        newOpen={newOpen}
        moreOpen={moreOpen}
      />
      <NewSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onNewInvoice={() => router.push(routes.newInvoice)}
        onNewReceipt={() => router.push(routes.newReceipt)}
      />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        role={userRole}
        onNavigate={navigate}
        onSignOut={logout.request}
      />
      {overlays}
    </SafeAreaView>
  );
}
