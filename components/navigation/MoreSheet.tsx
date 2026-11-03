// components/navigation/MoreSheet.tsx
// Phone "Továbbiak" sheet (SPEC §5.4): everything the sidebar carries that
// does not fit the five-tab bar (Nyugták, Termékek, E-mail szerkesztő,
// Adatexport, Tömeges feltöltés, Beállítások, Admin for admins) and,
// last, Kijelentkezés, which opens the logout confirm.
import { LogOut } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { SheetRow } from "@/components/navigation/SheetRow";
import { Sheet } from "@/components/ui/sheet";
import { getMobileMoreNav } from "@/lib/app-navigation";
import type { AppRoute } from "@/lib/navigation";

export type MoreSheetProps = {
  open: boolean;
  onClose: () => void;
  role?: string;
  onNavigate: (href: AppRoute) => void;
  /** Opens the logout confirm (the shell owns it). */
  onSignOut: () => void;
};

export function MoreSheet({ open, onClose, role, onNavigate, onSignOut }: MoreSheetProps) {
  const { t } = useTranslation();
  const items = getMobileMoreNav(role);

  return (
    <Sheet open={open} onClose={onClose} title={t("shell.tabs.moreSheetTitle")} presentation="sheet" testID="more-sheet">
      {items.map((item) => (
        <SheetRow
          key={item.href as string}
          testID={`more-sheet-${item.labelKey.replace("nav.", "")}`}
          label={t(item.labelKey)}
          icon={item.icon}
          onPress={() => {
            onClose();
            onNavigate(item.href);
          }}
        />
      ))}
      <SheetRow
        testID="more-sheet-sign-out"
        label={t("nav.signOut")}
        icon={LogOut}
        onPress={() => {
          onClose();
          onSignOut();
        }}
      />
    </Sheet>
  );
}
