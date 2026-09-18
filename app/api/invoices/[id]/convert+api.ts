// app/api/invoices/[id]/convert+api.ts
// "Számla készítése ebből" — converts a paid díjbekérő (proforma) into a
// draft invoice. Refuses a non-proforma or a cancelled proforma (400), and
// refuses converting the same proforma twice while a live conversion exists
// (409, carrying the existing invoice) — see lib/invoices/convert-proforma.ts.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { isUniqueViolation } from "@/lib/db/unique-violation";
import { canConvertProforma } from "@/lib/invoices/convert-proforma";
import {
  convertProformaToInvoice,
  findExistingConversion,
  getInvoiceById,
} from "@/lib/invoices/service";

const CONVERTED_FROM_LIVE_UNIQUE_INDEX = "invoice_converted_from_live_unique_idx";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const id = await resolveIdParam(request, params);
  const existing = await getInvoiceById(session.user.id, id);
  if (!existing) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  const canConvert = canConvertProforma(existing);
  if (!canConvert.ok) {
    return jsonResponse({ code: canConvert.reason }, 400);
  }

  const existingConversion = await findExistingConversion(session.user.id, existing.id);
  if (existingConversion) {
    return jsonResponse(
      { code: "alreadyConverted", invoice: existingConversion },
      409
    );
  }

  try {
    const invoice = await convertProformaToInvoice(session.user.id, existing);
    return jsonResponse({ invoice }, 201);
  } catch (e) {
    // The pre-check above is check-then-act and can race (two concurrent
    // requests, or two open tabs) — invoice_converted_from_live_unique_idx
    // is the DB-level backstop. When it fires, whoever won the race is
    // already committed, so re-run the same lookup the pre-check used and
    // return the identical 409 shape — no client change needed.
    if (isUniqueViolation(e, CONVERTED_FROM_LIVE_UNIQUE_INDEX)) {
      const winner = await findExistingConversion(session.user.id, existing.id);
      if (winner) {
        return jsonResponse({ code: "alreadyConverted", invoice: winner }, 409);
      }
      // The violation fired but the winner is no longer live (e.g. it was
      // cancelled between the insert and this re-lookup) — don't fabricate
      // a 409 with a null invoice; surface the original error instead.
    }
    throw e;
  }
}
