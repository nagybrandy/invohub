// components/navigation/NewCreateButton.tsx
// The split "Új számla" button at the top of the sidebar (tokens.md §6.10,
// §6.14). The main part opens a new invoice; the arrow opens a menu with
// Új számla, Új nyugta, a divider and Új partner. Esc closes the menu and puts
// focus back on the arrow. Collapsed (the 72px rail): a 44px "+" square that
// opens a new invoice, no arrow.
import * as React from "react";
import { ChevronDown, FilePlus, Plus, Receipt, UserPlus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { AnchoredPopover, MENU_PANEL_CLASS } from "@/components/layout/AnchoredPopover";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useMenuKeyboard } from "@/components/ui/menu/use-menu-keyboard";
import { useIconColors } from "@/lib/theme/icon-colors";

export type NewCreateButtonProps = {
  collapsed?: boolean;
  onNewInvoice: () => void;
  onNewReceipt: () => void;
  onNewPartner: () => void;
  testID?: string;
};

const ITEM =
  "min-h-11 flex-row items-center gap-3.5 rounded-control px-3 py-2.5 data-[hover=true]:bg-neutral-wash";

function CreateMenu({
  onNewInvoice,
  onNewReceipt,
  onNewPartner,
}: Pick<NewCreateButtonProps, "onNewInvoice" | "onNewReceipt" | "onNewPartner">) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const keyboard = useMenuKeyboard();
  return (
    <Box
      ref={keyboard.ref as never}
      // @ts-expect-error — onKeyDown is a web-only DOM prop on RN-web views.
      onKeyDown={keyboard.onKeyDown}
      accessibilityRole="menu"
      testID="new-create-menu"
    >
      <Pressable testID="new-create-invoice" accessibilityRole="menuitem" onPress={onNewInvoice} className={ITEM}>
        <FilePlus size={18} color={icons.muted} />
        <Text className="text-sm font-medium text-ink">{t("nav.newInvoice")}</Text>
      </Pressable>
      <Pressable testID="new-create-receipt" accessibilityRole="menuitem" onPress={onNewReceipt} className={ITEM}>
        <Receipt size={18} color={icons.muted} />
        <Text className="text-sm font-medium text-ink">{t("nav.newReceipt")}</Text>
      </Pressable>
      <Box className="mx-1 my-1 h-px bg-line" />
      <Pressable testID="new-create-partner" accessibilityRole="menuitem" onPress={onNewPartner} className={ITEM}>
        <UserPlus size={18} color={icons.muted} />
        <Text className="text-sm font-medium text-ink">{t("nav.newPartner")}</Text>
      </Pressable>
    </Box>
  );
}

export function NewCreateButton({
  collapsed = false,
  onNewInvoice,
  onNewReceipt,
  onNewPartner,
  testID = "new-create-button",
}: NewCreateButtonProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const [open, setOpen] = React.useState(false);
  const arrowRef = React.useRef<{ focus?: () => void } | null>(null);
  const close = React.useCallback(() => setOpen(false), []);
  const pick = (action: () => void) => () => {
    close();
    action();
  };

  if (collapsed) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={t("shell.newMenu.collapsedMain")}
        onPress={onNewInvoice}
        className="split-create mx-auto h-11 w-11 items-center justify-center rounded-[10px] bg-primary data-[hover=true]:bg-primary-press"
      >
        <Plus size={20} color={icons.onNavyActive} />
      </Pressable>
    );
  }

  return (
    <AnchoredPopover
      open={open}
      onClose={close}
      onEscape={() => arrowRef.current?.focus?.()}
      align="left"
      width={230}
      role="menu"
      panelClassName={`${MENU_PANEL_CLASS} shadow-create`}
      anchorClassName="flex w-full"
      testID="new-create-popover"
      anchor={
        <Box testID={testID} className="split-create h-[42px] w-full flex-row overflow-hidden rounded-[10px] bg-primary">
          <Pressable
            testID="new-create-main"
            accessibilityRole="button"
            accessibilityLabel={t("nav.newInvoice")}
            onPress={onNewInvoice}
            className="h-full min-w-0 flex-1 flex-row items-center gap-2 px-3.5 data-[hover=true]:bg-white/[0.14]"
          >
            <Plus size={18} color={icons.onNavyActive} />
            <Text numberOfLines={1} className="text-sm font-semibold text-white">
              {t("nav.newInvoice")}
            </Text>
          </Pressable>
          <Pressable
            ref={arrowRef as never}
            testID="new-create-arrow"
            accessibilityRole="button"
            accessibilityLabel={t("shell.newMenu.toggle")}
            accessibilityState={{ expanded: open }}
            aria-haspopup="menu"
            onPress={() => setOpen((v) => !v)}
            className="h-full w-[38px] items-center justify-center border-l border-white/[0.28] data-[hover=true]:bg-white/[0.14]"
          >
            <ChevronDown size={18} color={icons.onNavyActive} />
          </Pressable>
        </Box>
      }
    >
      <CreateMenu
        onNewInvoice={pick(onNewInvoice)}
        onNewReceipt={pick(onNewReceipt)}
        onNewPartner={pick(onNewPartner)}
      />
    </AnchoredPopover>
  );
}
