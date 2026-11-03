// components/invoices/composer/ComposerSection.tsx
// The building blocks of the one-page composer (tokens.md §6.18): a section
// divided from the previous one by a --line rule (22px padding, 16/700 head),
// the uppercase-headed "card" used by Kiküldés és megfelelőség, and the
// collapsible "További beállítások" card (closed by default).
import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useIconColors } from "@/lib/theme/icon-colors";
import { type } from "@/lib/ui/type";

export function ComposerSection({
  title,
  first = false,
  action,
  children,
  testID,
}: {
  title: string;
  /** The first section has no rule above it. */
  first?: boolean;
  /** Right side of the heading row (e.g. the gross-entry switch). */
  action?: React.ReactNode;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Box
      className={`py-[22px] ${first ? "" : "border-t border-line"}`}
      testID={testID}
    >
      <HStack className="mb-3 min-h-[28px] flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Heading accessibilityRole="header" aria-level={2} className={`${type.sectionTitle} flex-shrink-0`}>
          {title}
        </Heading>
        {action}
      </HStack>
      {children}
    </Box>
  );
}

const CARD_CLASS = "rounded-card border border-line-strong bg-surface";
const CARD_TITLE_CLASS = "text-xs font-bold uppercase tracking-[0.06em] text-muted-ink";

/** A bordered card with an uppercase micro-heading. */
export function ComposerCard({
  title,
  children,
  testID,
}: {
  title: string;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Box className={`${CARD_CLASS} p-[22px] phone:p-4`} testID={testID}>
      <Text accessibilityRole="header" className={`${CARD_TITLE_CLASS} mb-3`}>
        {title}
      </Text>
      {children}
    </Box>
  );
}

/** The collapsible card: the heading row is the toggle (aria-expanded), the body is mounted only while open. */
export function CollapsibleCard({
  title,
  open,
  onToggle,
  children,
  testID,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  const icons = useIconColors();
  return (
    <Box className={CARD_CLASS} testID={testID}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        aria-expanded={open}
        accessibilityState={{ expanded: open }}
        testID={testID ? `${testID}-toggle` : undefined}
        className="min-h-[56px] flex-row items-center justify-between px-[22px] phone:px-4"
      >
        <Text className={CARD_TITLE_CLASS}>{title}</Text>
        {open ? <ChevronUp size={18} color={icons.muted} /> : <ChevronDown size={18} color={icons.muted} />}
      </Pressable>
      {open ? <Box className="px-[22px] pb-[22px] phone:px-4 phone:pb-4">{children}</Box> : null}
    </Box>
  );
}
