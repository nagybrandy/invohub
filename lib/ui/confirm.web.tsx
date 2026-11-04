// lib/ui/confirm.web.tsx
// Web implementation of the cross-platform confirm() helper — see
// lib/ui/confirm.ts. react-native-web's Alert.alert is a true no-op
// (node_modules/react-native-web/dist/exports/Alert/index.js), so
// destructive actions on web must go through this instead.
//
// The API is unchanged (`confirmAsync(options) => Promise<boolean>`); it now
// renders the design's ConfirmDialog (icon circle, title, text, Mégse + the
// action; focus trapped and restored; Esc / scrim / Mégse resolve false)
// into a throwaway root on <body>. window.confirm remains only as the
// fallback when there is no DOM to render into.
import * as React from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog/index.web";
import type { ConfirmOptions } from "@/lib/ui/confirm";

export type { ConfirmOptions } from "@/lib/ui/confirm";

type DomRoot = { render: (node: React.ReactNode) => void; unmount: () => void };

function createDomRoot(container: Element): DomRoot | null {
  try {
    const client = require("react-dom/client") as { createRoot: (el: Element) => DomRoot };
    return client.createRoot(container);
  } catch {
    return null;
  }
}

function fallbackConfirm(options: ConfirmOptions): boolean {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return false;
  const text = options.message ? `${options.title}\n\n${options.message}` : options.title;
  return window.confirm(text);
}

export function confirmAsync(options: ConfirmOptions): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(fallbackConfirm(options));
  const host = document.createElement("div");
  host.setAttribute("data-confirm-host", "");
  document.body.appendChild(host);
  const root = createDomRoot(host);
  if (!root) {
    host.remove();
    return Promise.resolve(fallbackConfirm(options));
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    function settle(value: boolean) {
      if (settled) return;
      settled = true;
      // Closing first lets the Sheet restore focus to the trigger before the
      // root disappears.
      root!.render(
        <ConfirmDialog
          open={false}
          title={options.title}
          message={options.message}
          confirmLabel={options.confirmLabel}
          cancelLabel={options.cancelLabel}
          destructive={options.destructive}
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );
      setTimeout(() => {
        root!.unmount();
        host.remove();
      }, 0);
      resolve(value);
    }

    root.render(
      <ConfirmDialog
        open
        title={options.title}
        message={options.message}
        confirmLabel={options.confirmLabel}
        cancelLabel={options.cancelLabel}
        destructive={options.destructive}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />,
    );
  });
}
