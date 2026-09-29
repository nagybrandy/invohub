// components/invoices/NavDot.tsx
// The one rendering of a document's NAV state, shared by the desktop row and
// the mobile card so the two can't disagree. Renders nothing for "none".
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import type { NavListStatus } from "@/lib/nav/nav-indicator";

const CLASS: Record<Exclude<NavListStatus, "none">, string> = {
  notSubmitted: "bg-muted-foreground/30",
  inProgress: "bg-amber-500",
  done: "bg-primary",
  failed: "bg-destructive",
};

const HINT_KEY: Record<Exclude<NavListStatus, "none">, string> = {
  notSubmitted: "invoices.list.navNotSubmittedHint",
  inProgress: "invoices.list.navInProgressHint",
  done: "invoices.list.navDoneHint",
  failed: "invoices.list.navFailedHint",
};

export function NavDot({ status, testID = "invoice-row-nav-dot" }: { status: NavListStatus; testID?: string }) {
  const { t } = useTranslation();
  if (status === "none") return null;
  return (
    <Box
      testID={testID}
      accessibilityLabel={t(HINT_KEY[status])}
      // exposed for tests and for anyone reading the DOM
      accessibilityHint={status}
      className={`h-2.5 w-2.5 rounded-full ${CLASS[status]}`}
    />
  );
}
