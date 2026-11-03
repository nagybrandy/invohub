// lib/dashboard/todo-summary.ts
// Pure UI helpers for the Főoldal (SPEC §7.1). Never touches the summary SQL.
//
// "Teendő" = one "Következő lépések" card that is present: the NAV-error card,
// the overdue card and the drafts card. Only the NAV card is "sürgős".

export type TodoCounts = {
  navFailedCount?: number;
  overdueCount?: number;
  draftCount?: number;
};

export type TodoSummary = {
  /** Number of next-step cards (0 to 3). */
  total: number;
  /** 1 when the NAV-error card is present, else 0. */
  urgent: number;
  allDone: boolean;
};

function positive(n: number | undefined): boolean {
  return typeof n === "number" && n > 0;
}

export function computeTodoSummary(counts: TodoCounts): TodoSummary {
  const nav = positive(counts.navFailedCount) ? 1 : 0;
  const overdue = positive(counts.overdueCount) ? 1 : 0;
  const drafts = positive(counts.draftCount) ? 1 : 0;
  const total = nav + overdue + drafts;
  return { total, urgent: nav, allDone: total === 0 };
}

export type OutstandingSplitInput = {
  outstanding: number;
  overdueTotal: number;
  outstandingCount: number;
  overdueCount: number;
};

export type OutstandingSplit = {
  notDue: number;
  overdue: number;
  notDueCount: number;
  overdueCount: number;
  /** 0 to 1; the two shares add up to 1 when there is something outstanding. */
  notDueShare: number;
  overdueShare: number;
  /** False when there is nothing outstanding (no bar to draw). */
  hasBar: boolean;
};

/** Kintlévőség split: not-due = outstanding - overdue, overdue = overdueTotal. */
export function splitOutstanding(input: OutstandingSplitInput): OutstandingSplit {
  const outstanding = Math.max(0, input.outstanding);
  const overdue = Math.min(outstanding, Math.max(0, input.overdueTotal));
  const notDue = outstanding - overdue;
  const overdueCount = Math.max(0, input.overdueCount);
  const notDueCount = Math.max(0, input.outstandingCount - overdueCount);
  if (outstanding <= 0) {
    return { notDue: 0, overdue: 0, notDueCount, overdueCount, notDueShare: 0, overdueShare: 0, hasBar: false };
  }
  return {
    notDue,
    overdue,
    notDueCount,
    overdueCount,
    notDueShare: notDue / outstanding,
    overdueShare: overdue / outstanding,
    hasBar: true,
  };
}
