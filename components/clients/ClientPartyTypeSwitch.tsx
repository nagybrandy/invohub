// components/clients/ClientPartyTypeSwitch.tsx
// "Magánszemély" toggle on the partner form. A natural person who is not a
// VAT subject is reported to NAV as PRIVATE_PERSON — without name, address
// or tax number (see lib/nav/customer.ts) — so this must be explicit rather
// than guessed from a missing tax number.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { HStack } from "@/components/ui/hstack";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { ClientPartyType } from "@/lib/clients/party-type";

export function ClientPartyTypeSwitch({
  value,
  onChange,
}: {
  value: ClientPartyType | undefined;
  onChange: (value: ClientPartyType) => void;
}) {
  const { t } = useTranslation();
  return (
    <HStack className="items-center justify-between">
      <VStack className="flex-1 pr-3">
        <Text size="sm" className="font-medium text-foreground">
          {t("clients.privatePerson")}
        </Text>
        <Text size="xs" className="text-muted-foreground">
          {t("clients.privatePersonHint")}
        </Text>
      </VStack>
      <Switch
        testID="client-private-person-switch"
        value={value === "private_person"}
        onValueChange={(on: boolean) => onChange(on ? "private_person" : "company")}
        accessibilityLabel={t("clients.privatePerson")}
      />
    </HStack>
  );
}
