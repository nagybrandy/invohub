// components/invoices/composer/PartnerPicker.tsx
// The one required field of the document: an autocomplete over ALL saved
// partners (INV-18 — no chip cap), restyled in the 2026-11 redesign (SPEC §8.3,
// tokens.md §6.18): a 42px field, a popover list with the typed match in
// bold and the city on the right, the Hungarian company search below the
// saved partners, and a "+ Új partner: „…"" row that takes the typed text as
// the new partner's name (the rest is typed into the partner details card).
// Keyboard: ArrowDown / ArrowUp move through the list, Enter picks, Escape closes.
import * as React from "react";
import { Search } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { PartnerListOverlay } from "@/components/invoices/composer/PartnerListOverlay";
import { highlightParts } from "@/components/invoices/composer/composer-view";
import type { Client } from "@/lib/clients/service";
import type { CompanySearchResult } from "@/lib/company/search";
import { useIconColors } from "@/lib/theme/icon-colors";

const MAX_RESULTS = 8;

function matchesQuery(client: Client, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return (
    client.name.toLowerCase().includes(q) ||
    (client.taxNumber ?? "").toLowerCase().includes(q)
  );
}

type Entry =
  | { kind: "client"; key: string; client: Client }
  | { kind: "company"; key: string; company: CompanySearchResult }
  | { kind: "new"; key: string };

export function PartnerPicker({
  inputRef,
  clients,
  recentClients,
  value,
  onChangeText,
  onSelect,
  onCreateNew,
  companyResults = [],
  companyLoading = false,
  onSelectCompany,
  error,
  t,
}: {
  inputRef?: React.RefObject<{ focus: () => void } | null>;
  clients: Client[];
  recentClients: Client[];
  value: string;
  onChangeText: (value: string) => void;
  onSelect: (client: Client) => void;
  onCreateNew: (input: {
    name: string;
    email: string;
    taxNumber: string;
    zip: string;
    city: string;
    address: string;
  }) => Promise<void> | void;
  /** Hits from the Hungarian company search (NAV by adószám / registry by name). */
  companyResults?: CompanySearchResult[];
  companyLoading?: boolean;
  onSelectCompany?: (company: CompanySearchResult) => void;
  error?: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const icons = useIconColors();
  const [focused, setFocused] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const anchorRef = React.useRef<unknown>(null);
  // Set when a row is picked; the (web) input keeps focus, so the list is kept
  // closed until the user types again or re-focuses the field.
  const [dismissed, setDismissed] = React.useState(false);
  const query = value.trim();

  const results = React.useMemo(
    () => clients.filter((client) => matchesQuery(client, value)).slice(0, MAX_RESULTS),
    [clients, value]
  );

  // A company we already have saved is not offered a second time.
  const newCompanies = React.useMemo(() => {
    const savedTax = new Set(clients.map((c) => (c.taxNumber ?? "").replace(/\D/g, "").slice(0, 8)).filter(Boolean));
    return companyResults.filter((c) => !savedTax.has((c.taxNumber ?? "").replace(/\D/g, "").slice(0, 8)) || !c.taxNumber);
  }, [clients, companyResults]);

  const showResults = focused && !dismissed && query.length > 0;
  const showRecent = focused && !dismissed && query.length === 0 && recentClients.length > 0;
  const open = showResults || showRecent;

  const entries = React.useMemo<Entry[]>(() => {
    if (showRecent) return recentClients.map((client) => ({ kind: "client", key: `c-${client.id}`, client }));
    if (!showResults) return [];
    return [
      ...results.map((client): Entry => ({ kind: "client", key: `c-${client.id}`, client })),
      ...(onSelectCompany
        ? newCompanies.map(
            (company): Entry => ({
              kind: "company",
              key: `k-${company.taxNumber}|${company.registrationNumber ?? ""}|${company.name}`,
              company,
            })
          )
        : []),
      { kind: "new", key: "new" },
    ];
  }, [showRecent, showResults, recentClients, results, newCompanies, onSelectCompany]);

  React.useEffect(() => {
    setActive(-1);
  }, [value, focused]);

  function close() {
    setDismissed(true);
    setFocused(false);
  }

  function pick(entry: Entry) {
    if (entry.kind === "client") onSelect(entry.client);
    else if (entry.kind === "company") onSelectCompany?.(entry.company);
    else void onCreateNew({ name: query, email: "", taxNumber: "", zip: "", city: "", address: "" });
    close();
  }

  function handleKeyPress(event: { nativeEvent?: { key?: string }; preventDefault?: () => void }) {
    const key = event.nativeEvent?.key;
    if (!open || !key) return;
    if (key === "ArrowDown") {
      event.preventDefault?.();
      setActive((current) => (entries.length === 0 ? -1 : (current + 1) % entries.length));
    } else if (key === "ArrowUp") {
      event.preventDefault?.();
      setActive((current) => (entries.length === 0 ? -1 : (current <= 0 ? entries.length : current) - 1));
    } else if (key === "Enter" && active >= 0 && entries[active]) {
      event.preventDefault?.();
      pick(entries[active]);
    } else if (key === "Escape") {
      setFocused(false);
    }
  }

  const rowClass = (index: number) =>
    `min-h-11 flex-row items-center gap-2 rounded-control px-2.5 py-2 data-[hover=true]:bg-neutral-wash ${
      active === index ? "bg-neutral-wash" : ""
    }`;

  const clientRows = (list: Client[], offset: number) =>
    list.map((client, i) => {
      const parts = highlightParts(client.name, query);
      return (
        <Pressable
          key={client.id}
          nativeID={`composer-partner-option-${offset + i}`}
          onPress={() => {
            onSelect(client);
            close();
          }}
          role="option"
          aria-selected={active === offset + i}
          accessibilityRole="button"
          accessibilityLabel={client.name}
          testID={`composer-partner-option-${client.id}`}
          className={rowClass(offset + i)}
        >
          <Box className="min-w-0 flex-1">
            <Text className="text-sm text-ink">
              {parts.before}
              {parts.match ? <Text className="text-sm font-bold text-ink">{parts.match}</Text> : null}
              {parts.after}
            </Text>
            {client.taxNumber ? <Text className="text-xs text-muted-ink">{client.taxNumber}</Text> : null}
          </Box>
          {client.city ? <Text className="shrink-0 text-xs text-muted-ink">{client.city}</Text> : null}
        </Pressable>
      );
    });

  return (
    // @ts-expect-error — on web Box forwards the ref to its DOM node (the list anchors to it, below any error text).
    <Box ref={anchorRef} className="relative z-30" testID="composer-partner-picker">
      <Input data-invalid={Boolean(error)}>
        <InputField
          ref={inputRef as never}
          testID="composer-partner-search"
          accessibilityLabel={t("invoices.fields.partnerNameOrTax")}
          placeholder={t("invoices.composer.partnerSearchPlaceholder")}
          value={value}
          onChangeText={(text) => {
            setDismissed(false);
            setFocused(true);
            onChangeText(text);
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls="composer-partner-results"
          aria-activedescendant={active >= 0 ? `composer-partner-option-${active}` : undefined}
          onFocus={() => {
            setDismissed(false);
            setFocused(true);
          }}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyPress={handleKeyPress}
        />
      </Input>
      {error ? (
        <Text accessibilityRole="alert" className="mt-1 text-[13px] font-semibold text-err">
          {error}
        </Text>
      ) : null}

      <PartnerListOverlay open={open} anchorRef={anchorRef} id="composer-partner-results" testID="composer-partner-results">
          {showRecent ? (
            <>
              <Text className="px-2.5 pb-1 pt-1 text-xs font-semibold text-muted-ink">
                {t("invoices.composer.recentPartners")}
              </Text>
              {clientRows(recentClients, 0)}
            </>
          ) : (
            <>
              {results.length > 0 ? (
                clientRows(results, 0)
              ) : (
                <Text className="px-2.5 py-2 text-sm text-muted-ink">{t("invoices.composer.noPartnerResults")}</Text>
              )}

              {onSelectCompany && (companyLoading || newCompanies.length > 0) ? (
                <Box className="mt-1 border-t border-line pt-1" testID="composer-company-results">
                  <Text className="px-2.5 pb-1 pt-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted-ink">
                    {t("invoices.composer.hungarianCompanies")}
                  </Text>
                  {newCompanies.map((company, i) => {
                    const index = results.length + i;
                    return (
                      <Pressable
                        key={`${company.taxNumber}|${company.registrationNumber ?? ""}|${company.name}`}
                        nativeID={`composer-partner-option-${index}`}
                        onPress={() => {
                          onSelectCompany(company);
                          close();
                        }}
                        role="option"
                        aria-selected={active === index}
                        accessibilityRole="button"
                        accessibilityLabel={company.name}
                        className={rowClass(index)}
                      >
                        <Search size={14} color={icons.muted} />
                        <Box className="min-w-0 flex-1">
                          <Text className="text-sm text-ink">{company.name}</Text>
                          <Text className="text-xs text-muted-ink">
                            {[company.taxNumber || t("invoices.composer.companyTaxNumberMissing"), company.zipCode, company.city]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        </Box>
                      </Pressable>
                    );
                  })}
                  {companyLoading && newCompanies.length === 0 ? (
                    <Text className="px-2.5 py-2 text-sm text-muted-ink">{t("invoices.composer.companySearching")}</Text>
                  ) : null}
                </Box>
              ) : null}

              <Pressable
                nativeID={`composer-partner-option-${entries.length - 1}`}
                onPress={() => pick({ kind: "new", key: "new" })}
                role="option"
                aria-selected={active === entries.length - 1}
                accessibilityRole="button"
                testID="composer-partner-new"
                className={`mt-1 border-t border-line ${rowClass(entries.length - 1)}`}
              >
                <Text className="text-sm font-semibold text-primary">{t("composer.partnerNew", { name: query })}</Text>
              </Pressable>
            </>
          )}
      </PartnerListOverlay>
    </Box>
  );
}
