// components/settings/SettingsSheet.tsx
// The settings page pattern (SPEC §9.2, tokens.md §6.17): an h1 + lead, then
// ONE sheet card of sections. Each section is a two-column row (label + short
// helper left, controls right) once the SHEET itself is >= 640px wide and a
// single column below that, so it follows the pane and not the window.
import * as React from "react";
import { useWindowDimensions } from "react-native";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { LAYOUT } from "@/lib/theme/layout";
import { type } from "@/lib/ui/type";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";

// ---------------------------------------------------------------------------
// Page: h1 + lead
// ---------------------------------------------------------------------------

export function SettingsPage({
  title,
  lead,
  children,
  testID = "settings-page",
}: {
  title: string;
  lead?: string;
  children?: React.ReactNode;
  testID?: string;
}) {
  return (
    <Box testID={testID} className="w-full min-w-0 gap-4">
      <Box>
        <Heading accessibilityRole="header" className={type.pageTitle}>
          {title}
        </Heading>
        {lead ? <Text className={`${type.lead} mt-2 max-w-[560px]`}>{lead}</Text> : null}
      </Box>
      {children}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Sheet card + sections
// ---------------------------------------------------------------------------

const SheetWidthContext = React.createContext<{ twoColumn: boolean }>({ twoColumn: false });

/** True when the enclosing sheet is wide enough for the label | controls layout. */
export function useSettingsTwoColumn(): boolean {
  return React.useContext(SheetWidthContext).twoColumn;
}

export function SettingsSheet({
  children,
  testID = "settings-sheet",
  className = "",
}: {
  children?: React.ReactNode;
  testID?: string;
  className?: string;
}) {
  const { width, measured, onLayout } = useMeasuredWidth();
  const window = useWindowDimensions();
  // Before the first layout guess from the window so a desktop does not flash
  // the one-column layout; the measured width takes over right after.
  const twoColumn = measured
    ? width >= LAYOUT.settingsTwoColumnMin
    : window.width >= LAYOUT.settingsTwoColumnMin + 120;
  const value = React.useMemo(() => ({ twoColumn }), [twoColumn]);

  const items = React.Children.toArray(children);
  return (
    <SheetWidthContext.Provider value={value}>
      <Box
        testID={testID}
        onLayout={onLayout}
        className={`w-full min-w-0 overflow-hidden rounded-card bg-surface shadow-card ${className}`}
      >
        {items.map((child, index) => (
          <React.Fragment key={(React.isValidElement(child) && child.key) || index}>
            {index > 0 ? <Box aria-hidden className="h-px bg-line" /> : null}
            {child}
          </React.Fragment>
        ))}
      </Box>
    </SheetWidthContext.Provider>
  );
}

export function SettingsSection({
  title,
  hint,
  children,
  testID,
}: {
  title?: string;
  hint?: string;
  children?: React.ReactNode;
  testID?: string;
}) {
  const twoColumn = useSettingsTwoColumn();
  const label =
    title || hint ? (
      <Box className={twoColumn ? "min-w-[170px] flex-[0.75]" : "mb-4"}>
        {title ? (
          <Text className={type.itemTitle}>{title}</Text>
        ) : null}
        {hint ? <Text className={`${type.meta} mt-1`}>{hint}</Text> : null}
      </Box>
    ) : null;

  return (
    <Box testID={testID} className="px-4 py-5 tab:px-6 tab:py-[22px]">
      <Box className={twoColumn ? "flex-row items-start gap-9" : ""}>
        {label}
        <Box className={twoColumn ? "min-w-0 flex-[1.6] gap-4" : "gap-4"}>{children}</Box>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

const NOTE_TONES = {
  info: "bg-primary-wash",
  ok: "bg-ok-wash",
  warn: "bg-warn-wash",
  err: "bg-err-wash",
} as const;

const NOTE_TEXT = {
  info: "text-primary-ink",
  ok: "text-ok",
  warn: "text-warn",
  err: "text-err",
} as const;

export function SettingsNote({
  tone = "info",
  children,
  testID,
  className = "",
}: {
  tone?: keyof typeof NOTE_TONES;
  children?: React.ReactNode;
  testID?: string;
  className?: string;
}) {
  return (
    <Box
      testID={testID}
      accessibilityRole={tone === "err" ? "alert" : undefined}
      className={`rounded-control px-3.5 py-3 ${NOTE_TONES[tone]} ${className}`}
    >
      <Text className={`text-sm ${NOTE_TEXT[tone]} ${tone === "info" ? "font-semibold" : ""}`}>{children}</Text>
    </Box>
  );
}
