// lib/m2m/adozo.ts
// NAV M2M Adózó API — tax summary, missing declarations, public debt, detailed ledger.
import { randomUUID } from "crypto";
import type { M2mCredentials } from "@/lib/m2m/credentials";
import { M2M_BUSINESS_BASE_URL } from "@/lib/m2m/environment";
import { generateM2mSignature } from "@/lib/m2m/signature";

export type M2mAdozoResult<T> = {
  ok: boolean;
  resultCode?: string;
  resultMessage?: string | null;
  data: T | null;
};

export type M2mTaxSummary = {
  totalBalance: number;
  taxDebt: number;
  overpayment: number;
};

export type M2mMissingDeclaration = {
  title: string;
  type: string;
  period: string;
  dueDate: string;
};

export type M2mPublicDebt = {
  outstanding: number;
  assessed: number;
  items: { label: string; outstanding: number }[];
};

export type M2mDetailedTaxpayer = {
  name: string;
  taxNumber: string;
  address: string;
  period: string;
};

type AdozoSession = {
  credentials: M2mCredentials;
  accessToken: string;
  signingKey: string;
};

async function getAdozo<T>(
  session: AdozoSession,
  path: string
): Promise<M2mAdozoResult<T>> {
  const base = M2M_BUSINESS_BASE_URL[session.credentials.environment];
  const messageId = randomUUID();
  const signature = generateM2mSignature(messageId, "", session.signingKey);
  const sep = path.includes("?") ? "&" : "?";
  const url = `${base}${path}${sep}signature=${encodeURIComponent(signature)}`;

  const res = await fetch(url, {
    headers: {
      messageId,
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  const text = await res.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      resultMessage: `HTTP ${res.status}: ${text.slice(0, 120)}`,
      data: null,
    };
  }

  const resultCode = typeof parsed.resultCode === "string" ? parsed.resultCode : undefined;
  const resultMessage =
    typeof parsed.resultMessage === "string" || parsed.resultMessage === null
      ? (parsed.resultMessage as string | null)
      : undefined;
  const ok = res.ok && resultCode === "SIKERES";

  return { ok, resultCode, resultMessage, data: parsed as T };
}

function parseAmount(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

export async function fetchM2mTaxSummary(
  session: AdozoSession,
  taxpayerId: string
): Promise<M2mAdozoResult<M2mTaxSummary>> {
  const result = await getAdozo<{ osszesitettAdoszamla?: Record<string, unknown> }>(
    session,
    `/NavM2mAdozo/adozoService/OsszesitettAdoszamla/${taxpayerId}`
  );

  const raw = result.data?.osszesitettAdoszamla;
  if (!result.ok || !raw) return { ...result, data: null };

  return {
    ...result,
    data: {
      totalBalance: parseAmount(raw.ugyfelOsszesen),
      taxDebt: parseAmount(raw.adozoiTartozas),
      overpayment: parseAmount(raw.adozoiTulfizetes),
    },
  };
}

export async function fetchM2mMissingDeclarations(
  session: AdozoSession,
  taxpayerId: string
): Promise<M2mAdozoResult<M2mMissingDeclaration[]>> {
  const result = await getAdozo<{ hianyzoBevallas?: Array<Record<string, unknown>> }>(
    session,
    `/NavM2mAdozo/adozoService/HianyzoBevallas/${taxpayerId}`
  );

  const rows = result.data?.hianyzoBevallas ?? [];
  if (!result.ok) return { ...result, data: [] };

  return {
    ...result,
    data: rows.map((row) => ({
      title: String(row.bevallasMegnevezes ?? "Declaration").trim(),
      type: String(row.bevallasTipus ?? ""),
      period: String(row.bevallasIdoszak ?? ""),
      dueDate: String(row.eredetiEsedekesseg ?? ""),
    })),
  };
}

export async function fetchM2mPublicDebt(
  session: AdozoSession,
  taxpayerId: string
): Promise<M2mAdozoResult<M2mPublicDebt>> {
  const result = await getAdozo<{ koztartozasEgyenleg?: Record<string, unknown> }>(
    session,
    `/NavM2mAdozo/adozoService/KoztartozasEgyenleg/${taxpayerId}`
  );

  const raw = result.data?.koztartozasEgyenleg;
  if (!result.ok || !raw) return { ...result, data: null };

  const breakdown = Array.isArray(raw.jogcimBontas)
    ? (raw.jogcimBontas as Array<Record<string, unknown>>)
    : [];

  return {
    ...result,
    data: {
      outstanding: parseAmount(raw.osszesJogcimTeljesFennalloHatralek),
      assessed: parseAmount(raw.osszesEloiras),
      items: breakdown.map((item) => ({
        label: String(item.elnevezes ?? "Item"),
        outstanding: parseAmount(item.fennalloHatralek),
      })),
    },
  };
}

export async function fetchM2mDetailedTaxpayer(
  session: AdozoSession,
  taxpayerId: string,
  periodEnd = "2025-12-31"
): Promise<M2mAdozoResult<M2mDetailedTaxpayer>> {
  const query = new URLSearchParams({
    idoszakVege: periodEnd,
    tetelTipus: "KONYVELT_ES_KONYVELESRE_VARO",
  });
  const result = await getAdozo<{ tetelesAdoszamla?: { adozo?: Record<string, unknown> } }>(
    session,
    `/NavM2mAdozo/adozoService/TetelesAdoszamla/${taxpayerId}?${query.toString()}`
  );

  const adozo = result.data?.tetelesAdoszamla?.adozo;
  if (!result.ok || !adozo) return { ...result, data: null };

  return {
    ...result,
    data: {
      name: String(adozo.nev ?? ""),
      taxNumber: String(adozo.adoalanyAzonosito ?? taxpayerId),
      address: String(adozo.cim ?? ""),
      period: String(adozo.idoszak ?? ""),
    },
  };
}

export type { AdozoSession };
