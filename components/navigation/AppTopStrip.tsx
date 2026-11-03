// components/navigation/AppTopStrip.tsx
// The 56px top bar (SPEC §5.2): the global search field and the bell, nothing
// else. No page title, breadcrumb (they live in PageHeader), collapse toggle
// (moved into the sidebar head), language, theme or avatar (moved to Settings
// and the sidebar account menu).
import { GlobalSearchField } from "@/components/navigation/GlobalSearchField";
import { NotificationBell } from "@/components/navigation/NotificationBell";
import { Box } from "@/components/ui/box";

export type AppTopStripProps = {
  unreadCount: number;
  onOpenNotifications: () => void;
  notificationsOpen?: boolean;
};

export function AppTopStrip({ unreadCount, onOpenNotifications, notificationsOpen = false }: AppTopStripProps) {
  return (
    // z-10: popovers anchored in the bar must paint above the page content
    // (every RN-Web View is its own stacking context).
    <Box
      testID="app-topstrip"
      className="relative z-10 h-14 flex-row items-center justify-end gap-3 border-b border-line bg-surface px-5"
    >
      <GlobalSearchField variant="desktop" />
      <NotificationBell unreadCount={unreadCount} onPress={onOpenNotifications} expanded={notificationsOpen} />
    </Box>
  );
}
