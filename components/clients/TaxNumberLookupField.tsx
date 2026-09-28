// components/clients/TaxNumberLookupField.tsx
// Tax-number input with a NAV lookup button beside it — the partner forms'
// answer to "every new partner is typed by hand". On a hit the parent gets
// name/address/city/zip and decides what to overwrite.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTaxpayerLookup, type TaxpayerLookupResult } from "@/hooks/useTaxpayerLookup";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onFound: (taxpayer: TaxpayerLookupResult) => void;
  placeholder?: string;
};

export function TaxNumberLookupField({ value, onChangeText, onFound, placeholder }: Props) {
  const { t } = useTranslation();
  const { lookup, loading, error } = useTaxpayerLookup();
  const [notFound, setNotFound] = React.useState(false);

  async function handleLookup() {
    setNotFound(false);
    const taxpayer = await lookup(value);
    if (taxpayer) {
      onFound(taxpayer);
    } else if (!error) {
      setNotFound(true);
    }
  }

  const message = error ? t("settings.companySettings.lookupFailed") : notFound ? t("partners.lookupNotFound") : null;

  return (
    <FormControl>
      <FormControlLabel>
        <FormControlLabelText>{t("company.taxNumber")}</FormControlLabelText>
      </FormControlLabel>
      <HStack space="sm" className="items-center">
        <Input className="flex-1">
          <InputField
            value={value}
            onChangeText={(next) => {
              setNotFound(false);
              onChangeText(next);
            }}
            placeholder={placeholder ?? "12345678-1-23"}
            testID="client-tax-number"
          />
        </Input>
        <Button
          size="sm"
          variant="outline"
          onPress={() => void handleLookup()}
          disabled={loading || !value.trim()}
          testID="client-tax-number-lookup"
        >
          {loading ? <ButtonSpinner /> : null}
          <ButtonText>{t("settings.companySettings.lookup")}</ButtonText>
        </Button>
      </HStack>
      {message ? (
        <Text size="sm" className="text-muted-foreground" testID="client-tax-number-message">
          {message}
        </Text>
      ) : null}
    </FormControl>
  );
}
