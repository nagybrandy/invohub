// components/navigation/LogoutConfirm.tsx
// "Kijelentkezel?" (tokens.md §6.13): signing out always asks first. Used by
// the account menu, the phone "Továbbiak" sheet (and the settings start page
// later). Mégse, Esc and the scrim close it without signing out and the
// dialog returns focus to whatever opened it.
import * as React from "react";
import { LogOut } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type LogoutConfirmProps = {
  open: boolean;
  /** Mégse, Esc, scrim click: nothing happens, the dialog closes. */
  onCancel: () => void;
  /** Kijelentkezés: the caller signs out. */
  onConfirm: () => void;
  busy?: boolean;
};

export function LogoutConfirm({ open, onCancel, onConfirm, busy = false }: LogoutConfirmProps) {
  const { t } = useTranslation();
  return (
    <ConfirmDialog
      open={open}
      title={t("shell.logout.title")}
      message={t("shell.logout.text")}
      cancelLabel={t("shell.logout.cancel")}
      confirmLabel={t("shell.logout.confirm")}
      destructive
      icon={LogOut}
      busy={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
      testID="logout-confirm"
    />
  );
}

/**
 * State for the logout confirm: `request()` opens it, `cancel()` closes it,
 * `confirm()` closes it and runs the sign-out (once).
 */
export function useLogoutConfirm(signOut: () => void | Promise<void>) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const request = React.useCallback(() => setOpen(true), []);
  const cancel = React.useCallback(() => {
    if (!busy) setOpen(false);
  }, [busy]);
  const confirm = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }, [busy, signOut]);

  return { open, busy, request, cancel, confirm };
}
