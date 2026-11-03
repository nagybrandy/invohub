// components/invoices/NavStateIcon.tsx
// The one rendering of a document's NAV state (tokens.md §6.5), shared by the
// desktop table, the mobile card and the dashboard so they can't disagree:
//   failed      outlined red warning triangle in a 30x30 button; the tooltip
//               (hover / focus / long-press) carries the NAV reason
//   done        green tick at 55% opacity
//   inProgress  muted clock (NAV is still working on it)
//   notSubmitted / none  empty cell
import { AlertTriangle, Check, Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Tooltip } from "@/components/ui/tooltip";
import { useIconColors } from "@/lib/theme/icon-colors";
import type { NavListStatus } from "@/lib/nav/nav-indicator";

const HINT_KEY: Record<Exclude<NavListStatus, "none">, string> = {
  notSubmitted: "invoices.list.navNotSubmittedHint",
  inProgress: "invoices.list.navInProgressHint",
  done: "invoices.list.navDoneHint",
  failed: "invoices.list.navFailedHint",
};

export type NavStateIconProps = {
  status: NavListStatus;
  /** The NAV reason shown in the tooltip; defaults to the generic hint for the status. */
  reason?: string;
  testID?: string;
  /** Called when the failed-state button is pressed (e.g. open the invoice). */
  onPress?: () => void;
};

export function NavStateIcon({ status, reason, testID = "invoice-row-nav-dot", onPress }: NavStateIconProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  if (status === "none" || status === "notSubmitted") return null;

  const label = reason ?? t(HINT_KEY[status]);

  if (status === "failed") {
    return (
      <Tooltip content={label} testID={`${testID}-tooltip`}>
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          // exposed for tests and for anyone reading the DOM
          accessibilityHint={status}
          onPress={onPress}
          className="h-[30px] w-[30px] items-center justify-center rounded-control data-[hover=true]:bg-err-wash"
        >
          <AlertTriangle size={18} color={icons.destructive} />
        </Pressable>
      </Tooltip>
    );
  }

  if (status === "inProgress") {
    return (
      <Tooltip content={label} testID={`${testID}-tooltip`}>
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={status}
          onPress={onPress}
          className="h-[30px] w-[30px] items-center justify-center rounded-control data-[hover=true]:bg-neutral-wash"
        >
          <Clock size={17} color={icons.muted} />
        </Pressable>
      </Tooltip>
    );
  }

  return (
    <Box
      testID={testID}
      accessibilityLabel={label}
      accessibilityHint={status}
      className="h-[30px] w-[30px] items-center justify-center opacity-55"
    >
      <Check size={18} color={icons.ok} />
    </Box>
  );
}
