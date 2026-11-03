// components/navigation/NewSheet.tsx
// The phone "Új" sheet (SPEC §5.4): Új számla, Új nyugta.
import { FilePlus, Receipt } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { SheetRow } from "@/components/navigation/SheetRow";
import { Sheet } from "@/components/ui/sheet";

export type NewSheetProps = {
  open: boolean;
  onClose: () => void;
  onNewInvoice: () => void;
  onNewReceipt: () => void;
};

export function NewSheet({ open, onClose, onNewInvoice, onNewReceipt }: NewSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t("shell.tabs.newSheetTitle")} presentation="sheet" testID="new-sheet">
      <SheetRow
        testID="new-sheet-invoice"
        label={t("nav.newInvoice")}
        icon={FilePlus}
        onPress={() => {
          onClose();
          onNewInvoice();
        }}
      />
      <SheetRow
        testID="new-sheet-receipt"
        label={t("nav.newReceipt")}
        icon={Receipt}
        onPress={() => {
          onClose();
          onNewReceipt();
        }}
      />
    </Sheet>
  );
}
