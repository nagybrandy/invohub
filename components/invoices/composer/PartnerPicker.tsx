// components/invoices/composer/PartnerPicker.tsx
// Single required field of step 1: an autocomplete over ALL saved partners
// (INV-18 — the old 8-chip cap is gone), with a "+ Új partner" inline add
// row at the bottom of the results so adding one never leaves the form.
import * as React from "react";
import { Plus, Search } from "lucide-react-native";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { Client } from "@/lib/clients/service";
import { LISTBOX_ROLE, TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";
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

export function PartnerPicker({
  inputRef,
  clients,
  recentClients,
  value,
  onChangeText,
  onSelect,
  onCreateNew,
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
  error?: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const icons = useIconColors();
  const [focused, setFocused] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");
  const [newTaxNumber, setNewTaxNumber] = React.useState("");
  const [newZip, setNewZip] = React.useState("");
  const [newCity, setNewCity] = React.useState("");
  const [newAddress, setNewAddress] = React.useState("");

  const results = React.useMemo(
    () => clients.filter((client) => matchesQuery(client, value)).slice(0, MAX_RESULTS),
    [clients, value]
  );

  const showResults = focused && value.trim().length > 0;
  const showRecent = focused && value.trim().length === 0 && recentClients.length > 0;

  async function submitNewClient() {
    if (!newName.trim()) return;
    await onCreateNew({
      name: newName.trim(),
      email: newEmail.trim(),
      taxNumber: newTaxNumber.trim(),
      zip: newZip.trim(),
      city: newCity.trim(),
      address: newAddress.trim(),
    });
    setNewName("");
    setNewEmail("");
    setNewTaxNumber("");
    setNewZip("");
    setNewCity("");
    setNewAddress("");
    setCreating(false);
  }

  return (
    <VStack space="xs">
      <Input data-invalid={Boolean(error)}>
        <InputField
          ref={inputRef as never}
          testID="composer-partner-search"
          placeholder={t("invoices.composer.partnerSearchPlaceholder")}
          value={value}
          onChangeText={onChangeText}
          role="combobox"
          aria-expanded={showResults}
          aria-controls="composer-partner-results"
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          className="font-light"
        />
      </Input>
      {error ? (
        <Text size="xs" className="text-destructive">
          {error}
        </Text>
      ) : null}

      {showRecent ? (
        <VStack space="xs">
          <Text size="xs" className="font-light text-muted-foreground">
            {t("invoices.composer.recentPartners")}
          </Text>
          <HStack space="xs" className="flex-wrap">
            {recentClients.map((client) => (
              <Pressable
                key={client.id}
                onPress={() => onSelect(client)}
                accessibilityRole="button"
                accessibilityLabel={client.name}
                className={`items-center justify-center rounded-full border border-border bg-background px-3 py-1.5 ${TAP_TARGET_MIN_H}`}
              >
                <Text size="xs" className="font-light text-foreground">
                  {client.name}
                </Text>
              </Pressable>
            ))}
          </HStack>
        </VStack>
      ) : null}

      {showResults ? (
        <VStack
          nativeID="composer-partner-results"
          role={LISTBOX_ROLE}
          accessibilityRole="list"
          className="rounded-lg border border-border bg-card"
          space="xs"
        >
          {results.length > 0 ? (
            results.map((client) => (
              <Pressable
                key={client.id}
                onPress={() => onSelect(client)}
                role="option"
                aria-selected={false}
                accessibilityRole="button"
                accessibilityLabel={client.name}
                className={`flex-row items-center gap-2 border-b border-subtle px-3 py-2 last:border-b-0 ${TAP_TARGET_MIN_H}`}
              >
                <Search size={14} color={icons.muted} />
                <VStack className="flex-1">
                  <Text size="sm" className="text-foreground">
                    {client.name}
                  </Text>
                  {client.taxNumber ? (
                    <Text size="2xs" className="text-muted-foreground">
                      {client.taxNumber}
                    </Text>
                  ) : null}
                </VStack>
              </Pressable>
            ))
          ) : (
            <Text size="sm" className="px-3 py-2 text-muted-foreground">
              {t("invoices.composer.noPartnerResults")}
            </Text>
          )}

          {creating ? (
            <VStack space="xs" className="border-t border-subtle p-3">
              <Input>
                <InputField
                  placeholder={t("invoices.composer.newPartnerName")}
                  value={newName}
                  onChangeText={setNewName}
                />
              </Input>
              <Input>
                <InputField
                  placeholder={t("invoices.composer.newPartnerEmail")}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  keyboardType="email-address"
                />
              </Input>
              <Input>
                <InputField
                  placeholder={t("invoices.composer.newPartnerTaxNumber")}
                  value={newTaxNumber}
                  onChangeText={setNewTaxNumber}
                />
              </Input>
              <HStack space="xs">
                <Input className="w-[90px]">
                  <InputField
                    placeholder={t("invoices.fields.zipCode")}
                    value={newZip}
                    onChangeText={setNewZip}
                    testID="composer-new-partner-zip"
                  />
                </Input>
                <Input className="flex-1">
                  <InputField
                    placeholder={t("invoices.fields.city")}
                    value={newCity}
                    onChangeText={setNewCity}
                    testID="composer-new-partner-city"
                  />
                </Input>
              </HStack>
              <Input>
                <InputField
                  placeholder={t("invoices.fields.address")}
                  value={newAddress}
                  onChangeText={setNewAddress}
                  testID="composer-new-partner-address"
                />
              </Input>
              <Pressable
                onPress={() => void submitNewClient()}
                className="items-center rounded-md bg-primary px-3 py-2"
              >
                <Text size="sm" className="font-medium text-primary-foreground">
                  {t("invoices.composer.addPartnerConfirm")}
                </Text>
              </Pressable>
            </VStack>
          ) : (
            <Pressable
              onPress={() => setCreating(true)}
              className="flex-row items-center gap-2 border-t border-subtle px-3 py-2"
            >
              <Plus size={14} color={icons.primary} />
              <Text size="sm" className="font-medium text-primary">
                {t("invoices.composer.addPartner")}
              </Text>
            </Pressable>
          )}
        </VStack>
      ) : null}
    </VStack>
  );
}
