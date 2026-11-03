// components/ui/sheet/index.web.tsx
// Web Sheet (tokens.md §6.13): a portal to <body> with a scrim, a bottom sheet
// on phones and a centred dialog (max 460) above. Pure DOM on purpose: it
// must trap focus, close on Esc / scrim click / the close button, return
// focus to whatever opened it, and carry aria-modal + a label, none of which
// the React Native Modal does on web. Reduced motion is handled globally by
// global.css (transitions off).
import * as React from "react";
import { useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react-native";
import { focusInitial, rememberFocus, trapTab } from "@/lib/ui/focus-trap";
import { useIconColors } from "@/lib/theme/icon-colors";
import {
  DIALOG_MAX_WIDTH,
  resolvePresentation,
  type SheetProps,
} from "@/components/ui/sheet/layout";

// No @types/react-dom in this project; cast the import like the other portals.
const { createPortal } = require("react-dom") as {
  createPortal: (children: React.ReactNode, container: Element) => React.ReactPortal;
};

export type { SheetProps } from "@/components/ui/sheet/layout";
export { resolvePresentation, DIALOG_MAX_WIDTH } from "@/components/ui/sheet/layout";

// Only the top-most open sheet answers Esc and Tab (a confirm dialog opened
// from a sheet must not close both).
const openStack: symbol[] = [];

export function Sheet({
  open,
  onClose,
  title,
  accessibilityLabel,
  closeLabel,
  footer,
  children,
  presentation,
  maxWidth = DIALOG_MAX_WIDTH,
  topOffset,
  hideHeader = false,
  testID = "sheet",
}: SheetProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const icons = useIconColors();
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const [entered, setEntered] = React.useState(false);
  const titleId = React.useId();
  const kind = resolvePresentation(presentation, width);
  const isSheet = kind === "sheet";
  const label = closeLabel ?? t("ui.close");

  React.useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const token = Symbol("sheet");
    openStack.push(token);
    const restoreFocus = rememberFocus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => setEntered(true));
    // Wait a tick so the portal content is in the DOM before moving focus.
    const focusTimer = setTimeout(() => {
      if (panelRef.current) focusInitial(panelRef.current);
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (openStack[openStack.length - 1] !== token) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (panelRef.current) trapTab(event, panelRef.current);
    }
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      cancelAnimationFrame(frame);
      clearTimeout(focusTimer);
      const index = openStack.indexOf(token);
      if (index >= 0) openStack.splice(index, 1);
      document.body.style.overflow = previousOverflow;
      restoreFocus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const panelClass = isSheet
    ? `fixed inset-x-0 bottom-0 z-[1001] flex max-h-[88vh] flex-col rounded-t-sheet bg-surface px-4 pt-2 shadow-sheet transition-transform duration-[260ms] ease-out ${
        entered ? "translate-y-0" : "translate-y-full"
      }`
    : `fixed left-1/2 top-1/2 z-[1001] flex max-h-[calc(100%-48px)] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-dialog bg-surface shadow-dialog transition-opacity duration-150 ${
        entered ? "opacity-100" : "opacity-0"
      }`;

  const panelStyle: React.CSSProperties = isSheet
    ? {
        paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
        ...(topOffset ? { top: topOffset, maxHeight: "none" } : {}),
      }
    : { maxWidth };

  return createPortal(
    <div data-testid={testID}>
      <div
        data-testid={`${testID}-scrim`}
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-[1000] bg-[rgba(10,16,40,0.5)]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title && !accessibilityLabel ? titleId : undefined}
        aria-label={accessibilityLabel}
        tabIndex={-1}
        className={panelClass}
        style={panelStyle}
      >
        {isSheet ? <div className="mx-auto mb-1.5 mt-1 h-1 w-10 shrink-0 rounded-sm bg-line-strong" /> : null}
        {hideHeader ? null : (
          <div className={`flex shrink-0 items-center justify-between gap-3 ${isSheet ? "pb-2" : "px-5 pb-2 pt-[18px]"}`}>
            {title ? (
              <h2 id={titleId} className="m-0 min-w-0 flex-1 font-heading text-base font-bold text-ink">
                {title}
              </h2>
            ) : (
              <span className="flex-1" />
            )}
            <button
              type="button"
              data-testid={`${testID}-close`}
              data-close-button="true"
              aria-label={label}
              onClick={onClose}
              className="flex h-[38px] w-[38px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-neutral-wash"
            >
              <X size={18} color={icons.muted} />
            </button>
          </div>
        )}
        <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${isSheet ? "" : "px-5 pb-3 pt-1"}`}>
          {children}
        </div>
        {footer ? (
          <div className={`shrink-0 ${isSheet ? "pt-2" : "border-t border-line px-5 pb-[18px] pt-3"}`}>{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
