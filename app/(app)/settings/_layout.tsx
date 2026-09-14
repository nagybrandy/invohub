// app/(app)/settings/_layout.tsx
// Wraps every /settings/* sub-page with SettingsNav so there's always a
// one-click way back to the hub (N8/N9) — the hub itself doesn't need it,
// since it IS the hub (spec §1.3: no breadcrumb/back-link on a top-level
// screen).
import { Slot, usePathname } from "expo-router";
import { Box } from "@/components/ui/box";
import { SettingsNav } from "@/components/navigation/SettingsNav";
import { routes } from "@/lib/navigation";

export default function SettingsLayout() {
  const pathname = usePathname();
  const isHub = pathname === (routes.settings as string);

  return (
    <Box className="flex-1">
      {!isHub ? (
        <Box className="px-4 pt-4 md:px-10 md:pt-6">
          <SettingsNav />
        </Box>
      ) : null}
      <Slot />
    </Box>
  );
}
