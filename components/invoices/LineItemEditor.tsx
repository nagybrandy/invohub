// components/invoices/LineItemEditor.tsx
// Editable invoice line items with add/remove rows.

import { Trash2 } from "lucide-react-native";
import { Button, ButtonText } from "@/components/ui/button";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  createEmptyLineItem,
  formatCurrency,
  lineItemGrossTotal,
} from "@/lib/invoices/calculations";
import type { InvoiceCurrency, InvoiceLineItem, VatRate } from "@/lib/invoices/types";
import { useIconColors } from "@/lib/theme/icon-colors";

const VAT_OPTIONS: VatRate[] = [0, 5, 27];

export function LineItemEditor({
  lineItems,
  currency,
  onChange,
}: {
  lineItems: InvoiceLineItem[];
  currency: InvoiceCurrency;
  onChange: (items: InvoiceLineItem[]) => void;
}) {
  const icons = useIconColors();

  function updateItem(id: string, patch: Partial<InvoiceLineItem>) {
    onChange(
      lineItems.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function removeItem(id: string) {
    if (lineItems.length === 1) {
      return;
    }
    onChange(lineItems.filter((item) => item.id !== id));
  }

  function addItem() {
    onChange([...lineItems, createEmptyLineItem()]);
  }

  return (
    <VStack space="md">
      {lineItems.map((item, index) => (
        <VStack
          key={item.id}
          space="sm"
          className="rounded-lg border border-border p-3"
        >
          <HStack className="items-center justify-between">
            <Text className="font-medium text-foreground">Line {index + 1}</Text>
            {lineItems.length > 1 ? (
              <Pressable onPress={() => removeItem(item.id)} className="p-1">
                <Trash2 size={18} color={icons.muted} />
              </Pressable>
            ) : null}
          </HStack>

          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>Description</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField
                placeholder="Service or product"
                value={item.description}
                onChangeText={(value) => updateItem(item.id, { description: value })}
              />
            </Input>
          </FormControl>

          <HStack space="sm" className="flex-wrap">
            <FormControl className="min-w-[100px] flex-1">
              <FormControlLabel>
                <FormControlLabelText>Qty</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  keyboardType="decimal-pad"
                  value={String(item.quantity)}
                  onChangeText={(value) =>
                    updateItem(item.id, {
                      quantity: Math.max(0, Number(value) || 0),
                    })
                  }
                />
              </Input>
            </FormControl>

            <FormControl className="min-w-[120px] flex-1">
              <FormControlLabel>
                <FormControlLabelText>Unit price</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  keyboardType="decimal-pad"
                  value={String(item.unitPrice)}
                  onChangeText={(value) =>
                    updateItem(item.id, {
                      unitPrice: Math.max(0, Number(value) || 0),
                    })
                  }
                />
              </Input>
            </FormControl>
          </HStack>

          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>VAT rate</FormControlLabelText>
            </FormControlLabel>
            <HStack space="sm">
              {VAT_OPTIONS.map((rate) => (
                <Pressable
                  key={rate}
                  onPress={() => updateItem(item.id, { vatRate: rate })}
                  className={`rounded-md border px-3 py-2 ${
                    item.vatRate === rate
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background"
                  }`}
                >
                  <Text size="sm">{rate}%</Text>
                </Pressable>
              ))}
            </HStack>
          </FormControl>

          <Text size="sm" className="text-muted-foreground">
            Line total: {formatCurrency(lineItemGrossTotal(item), currency)}
          </Text>
        </VStack>
      ))}

      <Button variant="outline" onPress={addItem}>
        <ButtonText>Add line item</ButtonText>
      </Button>
    </VStack>
  );
}
