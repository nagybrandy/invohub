// app/(app)/settings/_layout.tsx
// The Beállítások frame (SPEC §9.1, tokens.md §6.17). It measures its OWN
// width, not the window's:
//  - >= 860px: a left nav (search + grouped rows, sticky) beside the page;
//    the bare /settings start page redirects to Céges profil, because the nav
//    already is the start list there;
//  - narrower: one column. /settings is the grouped start list, every
//    subpage gets a "‹ Beállítások" back link above it.
import { Redirect, Slot, usePathname } from "expo-router";
import { Box } from "@/components/ui/box";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { SettingsNav } from "@/components/navigation/SettingsNav";
import { routes } from "@/lib/navigation";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";

/** Settings frame width from which the left nav shows (tokens.md §6.17). */
export const SETTINGS_NAV_MIN_WIDTH = 860;

export default function SettingsLayout() {
  const pathname = usePathname();
  const isStart = pathname === (routes.settings as string);
  const { width, measured, onLayout } = useMeasuredWidth();
  const wide = measured && width >= SETTINGS_NAV_MIN_WIDTH;

  // The <Slot/> sits in ONE fixed position in every state (unmeasured, narrow,
  // wide) so the nested navigator mounts on the very first render. If it only
  // mounted after the first measure, the router's pathname would read as the
  // bare /settings on a deep link (the child route is unknown until the
  // navigator exists), the wide branch would redirect to Céges profil, and
  // /settings/templates would be lost on desktop.
  const redirectToCompany = wide && isStart;

  return (
    <ScreenLayout width="settings">
      <Box testID="settings-frame" onLayout={onLayout} className="w-full">
        <Box className={wide ? "w-full flex-row items-start gap-8" : "w-full"}>
          {wide ? (
            <Box className="w-[240px] shrink-0 web:sticky web:top-6" testID="settings-nav-column">
              <SettingsNav wide />
            </Box>
          ) : null}
          <Box
            className={wide ? "min-w-0 flex-1" : "w-full gap-3"}
            testID={measured ? "settings-pane" : undefined}
          >
            {measured && !wide && !isStart ? <SettingsNav /> : null}
            <Slot />
          </Box>
        </Box>
        {redirectToCompany ? <Redirect href={routes.settingsCompany} /> : null}
      </Box>
    </ScreenLayout>
  );
}
