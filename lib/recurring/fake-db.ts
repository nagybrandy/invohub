// lib/recurring/fake-db.ts
// TEST-ONLY in-memory stand-in for the drizzle query builder, interpreting
// the handful of operators the recurring service uses (and/eq/lte/inArray…).
// Lives next to the tests (not under a __mocks__ dir) so jest.mock factories
// can require it. Never imported by app code.
/* eslint-disable @typescript-eslint/no-explicit-any */

type Cond = { op: string; [k: string]: any } | undefined;

export const operatorMocks = {
  and: (...conds: Cond[]) => ({ op: "and", conds: conds.filter(Boolean) }),
  eq: (col: any, val: unknown) => ({ op: "eq", col, val }),
  lte: (col: any, val: unknown) => ({ op: "lte", col, val }),
  asc: (col: any) => ({ op: "asc", col }),
  desc: (col: any) => ({ op: "desc", col }),
};

function camel(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function matches(cond: Cond, row: Record<string, any>): boolean {
  if (!cond) return true;
  switch (cond.op) {
    case "and":
      return cond.conds.every((c: Cond) => matches(c, row));
    case "eq":
      return row[camel(cond.col.name)] === cond.val;
    case "lte":
      return row[camel(cond.col.name)] != null && row[camel(cond.col.name)] <= cond.val;
    default:
      throw new Error(`fake-db: unsupported condition ${cond.op}`);
  }
}

export type FakeTables = Map<unknown, Record<string, any>[]>;

/** `uniques` maps a table to the column keys that must be unique together. */
export function createFakeDb(tables: FakeTables, uniques: Map<unknown, string[]> = new Map()) {
  const rowsOf = (t: unknown) => {
    if (!tables.has(t)) tables.set(t, []);
    return tables.get(t)!;
  };

  const select = (_fields?: unknown) => ({
    from: (t: unknown) => {
      let cond: Cond;
      let order: Cond;
      let max = Infinity;
      const run = () => {
        let out = rowsOf(t).filter((r) => matches(cond, r)).map((r) => ({ ...r }));
        if (order) {
          const key = camel(order.col.name);
          const dir = order.op === "desc" ? -1 : 1;
          out = out.sort((a, b) => (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0));
        }
        return out.slice(0, max);
      };
      const q: any = {
        where: (c: Cond) => {
          cond = c;
          return q;
        },
        orderBy: (o: Cond) => {
          order = o;
          return q;
        },
        limit: (n: number) => {
          max = n;
          return q;
        },
        then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
      };
      return q;
    },
  });

  const insert = (t: unknown) => ({
    values: (v: any) => {
      let ignore = false;
      const doInsert = () => {
        const list = Array.isArray(v) ? v : [v];
        const inserted: any[] = [];
        for (const row of list) {
          const keys = uniques.get(t);
          const dup = keys && rowsOf(t).some((r) => keys.every((k) => r[k] === row[k]));
          if (dup) {
            if (ignore) continue;
            throw new Error("duplicate key value violates unique constraint");
          }
          const stored = { ...row };
          rowsOf(t).push(stored);
          inserted.push({ ...stored });
        }
        return inserted;
      };
      const q: any = {
        onConflictDoNothing: () => {
          ignore = true;
          return q;
        },
        returning: () => Promise.resolve(doInsert()),
        then: (res: any, rej: any) => Promise.resolve(doInsert()).then(res, rej),
      };
      return q;
    },
  });

  const update = (t: unknown) => ({
    set: (patch: any) => ({
      where: (cond: Cond) => {
        const doUpdate = () => {
          const hit = rowsOf(t).filter((r) => matches(cond, r));
          hit.forEach((r) => Object.assign(r, patch));
          return hit.map((r) => ({ ...r }));
        };
        const q: any = {
          returning: () => Promise.resolve(doUpdate()),
          then: (res: any, rej: any) => Promise.resolve(doUpdate()).then(res, rej),
        };
        return q;
      },
    }),
  });

  const del = (t: unknown) => ({
    where: (cond: Cond) => {
      const doDelete = () => {
        const list = rowsOf(t);
        const gone = list.filter((r) => matches(cond, r));
        tables.set(
          t,
          list.filter((r) => !gone.includes(r))
        );
        return gone.map((r) => ({ ...r }));
      };
      const q: any = {
        returning: () => Promise.resolve(doDelete()),
        then: (res: any, rej: any) => Promise.resolve(doDelete()).then(res, rej),
      };
      return q;
    },
  });

  return { select, insert, update, delete: del };
}
