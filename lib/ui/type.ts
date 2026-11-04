// lib/ui/type.ts
// The one type scale (docs/design/redesign-2026-11/tokens.md §3) as className
// presets, so screens do not invent sizes. Compose with template strings:
//   <Heading className={type.pageTitle}>
// Phone sizes use the `phone:` variant (max-width 700, tailwind.config.js).
export const type = {
  /** h1: 26/700 head, phone 22. */
  pageTitle:
    "font-heading text-[26px] phone:text-[22px] font-bold leading-[1.1] tracking-[-0.01em] text-ink",
  /** Page lead / subtitle: 14 muted, phone 13. */
  lead: "text-sm phone:text-[13px] text-muted-ink",
  /** Section / card title (h2): 16/700 head, phone 15. */
  sectionTitle: "font-heading text-base phone:text-[15px] font-bold leading-[1.2] text-ink",
  /** Row / card item title: 15/600. */
  itemTitle: "text-[15px] font-semibold leading-[1.3] text-ink",
  body: "text-sm text-ink",
  /** Helper / meta / table header: 13. */
  meta: "text-[13px] text-muted-ink",
  /** Badges, chips, group labels: 12. */
  micro: "text-xs",
  /** Hero number (Kintlévőség): 30/700, phone 26. */
  heroNumber: "text-[30px] phone:text-[26px] font-bold leading-[1.1] tracking-[-0.01em] tabular-nums",
  /** KPI number (stat card): 20/700, phone 18. */
  kpiNumber: "text-xl phone:text-lg font-bold leading-[1.15] tabular-nums",
  /** Money is always tabular and never wraps. */
  money: "tabular-nums whitespace-nowrap",
} as const;

export type TypePreset = keyof typeof type;
