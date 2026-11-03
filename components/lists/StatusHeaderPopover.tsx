// components/lists/StatusHeaderPopover.tsx
// The "Státusz" table header: a button that opens the status filter popover
// (tokens.md §6.14). The prototype's checkboxes are multi-select; the API
// filters by ONE status, so the rows are single-choice radios with counts and
// the footer resets to "all" (listed as an open issue in the redesign notes).
// Esc and an outside press close it (AnchoredPopover).
import * as React from "react";
import { ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { AnchoredPopover, MENU_PANEL_CLASS } from "@/components/layout/AnchoredPopover";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useIconColors } from "@/lib/theme/icon-colors";

export type StatusOption<K extends string = string> = { key: K; label: string; count?: number };

export function StatusHeaderPopover<K extends string>({
  label,
  options,
  value,
  resetValue,
  onChange,
}: {
  label: string;
  options: StatusOption<K>[];
  value: K | null;
  /** The key that means "no status filter" (the reset button selects it). */
  resetValue: K;
  onChange: (key: K) => void;
}) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const [open, setOpen] = React.useState(false);
  const active = value !== null && value !== resetValue;

  return (
    <AnchoredPopover
      open={open}
      onClose={() => setOpen(false)}
      align="left"
      width={232}
      role="dialog"
      panelClassName={MENU_PANEL_CLASS}
      testID="status-popover"
      anchor={
        <Pressable
          testID="status-header-button"
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((v) => !v)}
          className="min-h-[34px] flex-row items-center gap-1 justify-center"
        >
          <Text size="sm" className={`text-[13px] font-medium ${active || open ? "text-ink" : "text-muted-ink"}`}>
            {label}
          </Text>
          <ChevronDown size={13} color={active || open ? icons.foreground : icons.muted} />
        </Pressable>
      }
    >
      <Box accessibilityRole="radiogroup" accessibilityLabel={label} testID="status-popover-options">
        {options.map((option) => {
          const selected = option.key === value;
          return (
            <Pressable
              key={option.key}
              testID={`status-option-${option.key}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => {
                onChange(option.key);
                setOpen(false);
              }}
              className="min-h-10 flex-row items-center gap-3 rounded-control px-3 py-2 data-[hover=true]:bg-neutral-wash"
            >
              <Box
                className={`h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${
                  selected ? "border-primary" : "border-line-strong"
                }`}
              >
                {selected ? <Box className="h-2 w-2 rounded-full bg-primary" /> : null}
              </Box>
              <Text className="flex-1 text-sm font-medium text-ink">{option.label}</Text>
              {typeof option.count === "number" ? (
                <Text numeric className="text-[13px] text-faint">
                  {option.count}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </Box>
      <Box className="mt-1.5 flex-row justify-end border-t border-line px-1.5 pb-0.5 pt-2.5">
        <Button
          size="sm"
          variant="secondary"
          testID="status-popover-reset"
          onPress={() => {
            onChange(resetValue);
            setOpen(false);
          }}
        >
          <ButtonText>{t("lists.reset")}</ButtonText>
        </Button>
      </Box>
    </AnchoredPopover>
  );
}
