// components/layout/menu-shared.ts
// Platform-neutral pieces shared by OverflowMenu(.web) and
// AnchoredPopover(.web). They live in their own file because on web the import
// "@/components/layout/OverflowMenu" resolves to OverflowMenu.web.tsx itself,
// so a .web file cannot import runtime values from its native twin.
import type * as React from "react";

/** The design allows at most five actions in a menu (tokens.md §6.14). */
export const MAX_MENU_ITEMS = 5;

export type OverflowMenuItem = {
  label: string;
  onPress: () => void;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  destructive?: boolean;
  disabled?: boolean;
};

/** Warns (development only) when a menu is given more than the design allows. */
export function warnIfTooManyItems(count: number): void {
  if (count > MAX_MENU_ITEMS && process.env.NODE_ENV !== "production") {
    console.warn(
      `[OverflowMenu] ${count} actions given; the design allows at most ${MAX_MENU_ITEMS}. Move the rest to the detail page.`,
    );
  }
}

/** The "⋮" trigger: 34x34 (40 on phones), radius 8, neutral hover. */
export const MENU_TRIGGER_CLASS =
  "h-[34px] w-[34px] phone:h-10 phone:w-10 items-center justify-center rounded-control data-[hover=true]:bg-neutral-wash";

/** One menu row: 44px floor, 14px gap, hover/focus on the neutral wash. */
export const MENU_ITEM_CLASS =
  "min-h-11 flex-row items-center gap-3.5 rounded-control px-3.5 py-3 data-[hover=true]:bg-neutral-wash";

/** Default AnchoredPopover panel: a padded raised card (forms). */
export const POPOVER_PANEL_CLASS = "rounded-menu border border-line-strong bg-surface p-4 shadow-menu";

/** Menu panel look (tokens.md §6.14): 12px radius, 6px padding, line-strong border. */
export const MENU_PANEL_CLASS = "rounded-menu border border-line-strong bg-surface p-1.5 shadow-menu";

export type AnchoredPopoverProps = {
  open: boolean;
  onClose: () => void;
  /** The trigger; rendered by the popover so it can be measured. */
  anchor: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  /** Panel width in px. */
  width?: number;
  testID?: string;
  /** Open below (default) or above the anchor (the sidebar account menu opens upward). */
  placement?: "below" | "above";
  /** Replaces the default panel look (form popovers: padded card), e.g. for menus. */
  panelClassName?: string;
  /** Classes of the wrapper around the anchor (web: `inline-flex`; pass `flex w-full` to stretch a full-width trigger). */
  anchorClassName?: string;
  /** Accessible role of the panel: `dialog` (default) or `menu`. */
  role?: "dialog" | "menu";
  /** Called when Escape closed the popover (web), so the caller can refocus its trigger. */
  onEscape?: () => void;
};
