// components/navigation/DesktopTopBar.tsx
import { Bell, ChevronDown, FileText, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useIconColors } from "@/lib/theme/icon-colors";
import type { AppRoute } from "@/lib/navigation";

type DesktopTopBarProps = {
  companyName?: string;
  companyTaxId?: string;
  navItems: { href: AppRoute; labelKey: string }[];
  activeHref: string;
  unreadCount: number;
  userName?: string;
  onNavigate: (href: AppRoute) => void;
  onNewInvoice: () => void;
  onOpenNotifications: () => void;
  /** Company name/tax-id button — there's no multi-company switcher (a user
   * has exactly one company profile), so this opens that profile's settings
   * rather than a dropdown the chevron implied. */
  onOpenCompanySettings: () => void;
  /** Avatar button — opens account settings (sign-out lives there today);
   * previously had no handler at all. */
  onOpenAccountSettings: () => void;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function DesktopTopBar({
  companyName,
  companyTaxId,
  navItems,
  activeHref,
  unreadCount,
  userName,
  onNavigate,
  onNewInvoice,
  onOpenNotifications,
  onOpenCompanySettings,
  onOpenAccountSettings,
}: DesktopTopBarProps) {
  const { t } = useTranslation();
  const icons = useIconColors();

  return (
    <Box className="bg-secondary px-10 py-4">
      <HStack className="mx-auto w-full max-w-[1440px] items-center justify-between">
        {/* Left: logo + company dropdown + nav links */}
        <HStack space="lg" className="items-center">
          <FileText size={24} color="#f9f9f9" />

          {/* Company profile button — opens that company's settings (there's
              only ever one company, so this isn't a switcher despite the
              chevron). */}
          <Pressable
            onPress={onOpenCompanySettings}
            accessibilityRole="button"
            accessibilityLabel={t("nav.companySettings")}
            className="w-60 flex-row items-center justify-between rounded-lg bg-[#1f305e] px-3 py-2"
          >
            <VStack>
              <Text className="text-sm font-medium text-white" numberOfLines={1}>
                {companyName || "InvoHub"}
              </Text>
              {companyTaxId ? (
                <Text className="text-[10px] font-light text-[#c5c7ca]" numberOfLines={1}>
                  {companyTaxId}
                </Text>
              ) : null}
            </VStack>
            <ChevronDown size={20} color="#c5c7ca" />
          </Pressable>

          {/* Nav links */}
          <HStack space="xl" className="items-center">
            {navItems.map((item) => {
              const href = String(item.href);
              const isActive =
                activeHref === href || activeHref.startsWith(`${href}/`);
              return (
                <Pressable
                  key={href}
                  onPress={() => onNavigate(item.href)}
                >
                  <Text
                    className={`text-sm ${isActive ? "font-semibold text-white" : "font-normal text-[#f9f9f9]"}`}
                  >
                    {t(item.labelKey)}
                  </Text>
                  {isActive ? (
                    <Box className="mt-1 h-0.5 rounded-full bg-white" />
                  ) : null}
                </Pressable>
              );
            })}
          </HStack>
        </HStack>

        {/* Right: new invoice + bell + avatar + language (right-most) */}
        <HStack space="md" className="items-center">
          <Pressable
            onPress={onNewInvoice}
            className="flex-row items-center gap-2 rounded-lg bg-primary px-4 py-2"
          >
            <Plus size={16} color="#ffffff" />
            <Text className="text-sm font-medium text-white">
              {t("nav.newInvoice")}
            </Text>
          </Pressable>

          <Pressable
            onPress={onOpenNotifications}
            className="relative rounded-full p-2"
          >
            <Bell size={20} color="#f9f9f9" />
            {unreadCount > 0 ? (
              <Box className="absolute -right-0.5 -top-0.5 min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 py-0.5">
                <Text className="text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </Box>
            ) : null}
          </Pressable>

          <Pressable
            onPress={onOpenAccountSettings}
            accessibilityRole="button"
            accessibilityLabel={t("nav.accountSettings")}
            className="h-9 w-9 items-center justify-center rounded-full bg-[#111f4a]"
          >
            <Text className="text-xs font-bold text-white">
              {initials(userName || "U")}
            </Text>
          </Pressable>

          <LanguageSwitcher tone="onDark" />
        </HStack>
      </HStack>
    </Box>
  );
}
