// components/lists/ListCardRow.tsx
// One row of the narrow list (tokens.md §6.7): line 1 = title (regular, one
// line) + the amount (bold, right); line 2 = "number · date" 13px muted;
// line 3 = pills / NAV icon / "Lejárt N napja" on the left and the row menu on
// the right. A row without pills (partners, products) keeps the menu at the
// right, centred against the whole row. The whole row is the tap target
// (>= 40px on a phone).
import type { ReactNode } from "react";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

export type ListCardRowProps = {
  title: string;
  /** Bold, right-aligned, tabular (money). */
  amount?: string;
  /** Line 2, e.g. "INV-2026-00017 · 2026. 11. 01." */
  meta?: string;
  /** Line 3, left: status pill, NAV icon, overdue label. */
  badges?: ReactNode;
  /** The "..." menu: line 3 right when there are badges, else beside the whole row. */
  menu?: ReactNode;
  onPress?: () => void;
  testID?: string;
};

export function ListCardRow({ title, amount, meta, badges, menu, onPress, testID = "list-card-row" }: ListCardRowProps) {
  const inlineMenu = !badges && !!menu;

  const text = (
    <Box className="min-w-0 flex-1">
      <Box className="flex-row items-start justify-between gap-2.5">
        <Text numberOfLines={1} className="whitespace-nowrap min-w-0 flex-1 text-[15px] text-ink">
          {title}
        </Text>
        {amount ? (
          <Text numeric numberOfLines={1} className="whitespace-nowrap shrink-0 text-[15px] font-bold text-ink">
            {amount}
          </Text>
        ) : null}
      </Box>
      {meta ? (
        <Text numberOfLines={1} className="whitespace-nowrap mt-0.5 text-[13px] text-muted-ink">
          {meta}
        </Text>
      ) : null}
      {badges || (menu && !inlineMenu) ? (
        <Box className="mt-1.5 min-h-[34px] flex-row items-center justify-between gap-2">
          <Box className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">{badges}</Box>
          {menu ? <Box className="-mr-1.5 shrink-0">{menu}</Box> : null}
        </Box>
      ) : null}
    </Box>
  );

  const body = (
    <Box className="min-h-[56px] flex-row items-center gap-1 px-3.5 py-3">
      {text}
      {inlineMenu ? <Box className="-mr-1.5 shrink-0">{menu}</Box> : null}
    </Box>
  );

  return onPress ? (
    <Pressable testID={testID} onPress={onPress} className="web:cursor-pointer data-[hover=true]:bg-wash2">
      {body}
    </Pressable>
  ) : (
    <Box testID={testID}>{body}</Box>
  );
}
