// lib/ui/confirm.ts
// Cross-platform "are you sure?" confirmation. Native (iOS/Android) uses
// RN's Alert.alert, which react-native-web stubs out as a no-op — see
// lib/ui/confirm.web.ts for the web implementation. Always call this
// instead of Alert.alert directly for anything destructive that also runs
// on web (delete/storno/correction), or the confirmation silently never
// appears there and the action never fires.
import { Alert } from "react-native";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Renders the confirm button in the platform's destructive style. */
  destructive?: boolean;
};

export function confirmAsync(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    function settle(value: boolean) {
      if (settled) return;
      settled = true;
      resolve(value);
    }

    Alert.alert(
      options.title,
      options.message,
      [
        { text: options.cancelLabel, style: "cancel", onPress: () => settle(false) },
        {
          text: options.confirmLabel,
          style: options.destructive ? "destructive" : "default",
          onPress: () => settle(true),
        },
      ],
      { cancelable: true, onDismiss: () => settle(false) }
    );
  });
}
