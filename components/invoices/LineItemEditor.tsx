// components/invoices/LineItemEditor.tsx
// Editable invoice line items: add/remove rows, per-line VAT category and rate.
import { useTranslation } from "react-i18next";
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
import { resolveVatExemptionReason, VAT_CATEGORIES, VAT_RATES } from "@/lib/invoices/vat";
import type { InvoiceCurrency, InvoiceLineItem, VatCategory, VatRate } from "@/lib/invoices/types";
import { useIconColors } from "@/lib/theme/icon-colors";
import { confirmAsync } from "@/lib/ui/confirm";

export function LineItemEditor({
  lineItems,
  currency,
  onChange,
  companyVatExempt = false,
}: {
  lineItems: InvoiceLineItem[];
  currency: InvoiceCurrency;
  onChange: (items: InvoiceLineItem[]) => void;
  /** Company is alanyi adómentes — new rows default to AAM/0% instead of normal/27%. */
  companyVatExempt?: boolean;
}) {
  const { t } = useTranslation();
  const icons = useIconColors();

  function updateItem(id: string, patch: Partial<InvoiceLineItem>) {
    onChange(
      lineItems.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function setVatCategory(id: string, category: VatCategory) {
    updateItem(id, {
      vatCategory: category,
      vatRate: category === "normal" ? 27 : 0,
    });
  }

  async function removeItem(id: string) {
    if (lineItems.length === 1) {
      return;
    }
    const item = lineItems.find((li) => li.id === id);
    // A blank, never-touched row can go without a prompt; anything with
    // real content gets the same confirm-before-delete treatment as the
    // invoice-level delete flow (InvoiceCard), instead of vanishing on a
    // single mis-tap of a small icon.
    if (item?.description.trim()) {
      const confirmed = await confirmAsync({
        title: t("invoices.lineItemEditor.deleteTitle"),
        message: t("invoices.lineItemEditor.deleteMessage", { description: item.description }),
        confirmLabel: t("common.delete"),
        cancelLabel: t("common.cancel"),
        destructive: true,
      });
      if (!confirmed) return;
    }
    onChange(lineItems.filter((li) => li.id !== id));
  }

  function addItem() {
    onChange([...lineItems, createEmptyLineItem({ vatExempt: companyVatExempt })]);
  }

  return (
    <VStack space="md">
      {lineItems.map((item, index) => {
        const isExempt = item.vatCategory !== "normal";
        const reasonPreview = resolveVatExemptionReason(item.vatCategory, item.vatExemptionReason);

        return (
          <VStack
            key={item.id}
            space="sm"
            className="rounded-lg border border-border p-3"
          >
            <HStack className="items-center justify-between">
              <Text className="font-medium text-foreground">
                {t("invoices.lineItemEditor.lineLabel", { index: index + 1 })}
              </Text>
              {lineItems.length > 1 ? (
                <Pressable
                  onPress={() => void removeItem(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t("invoices.lineItemEditor.deleteAction")}
                  hitSlop={8}
                  className="h-11 w-11 items-center justify-center"
                >
                  <Trash2 size={18} color={icons.muted} />
                </Pressable>
              ) : null}
            </HStack>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t("invoices.lineItemEditor.description")}</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  placeholder={t("invoices.lineItemEditor.descriptionPlaceholder")}
                  value={item.description}
                  onChangeText={(value) => updateItem(item.id, { description: value })}
                />
              </Input>
            </FormControl>

            <HStack space="sm" className="flex-wrap">
              <FormControl className="min-w-[100px] flex-1">
                <FormControlLabel>
                  <FormControlLabelText>{t("invoices.lineItemEditor.quantity")}</FormControlLabelText>
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
                  <FormControlLabelText>{t("invoices.lineItemEditor.unitPrice")}</FormControlLabelText>
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
                <FormControlLabelText>{t("invoices.vat.categoryLabel")}</FormControlLabelText>
              </FormControlLabel>
              <HStack space="xs" className="flex-wrap">
                {VAT_CATEGORIES.map((category) => (
                  <Pressable
                    key={category}
                    onPress={() => setVatCategory(item.id, category)}
                    className={`rounded-md border px-2.5 py-2 ${
                      item.vatCategory === category
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background"
                    }`}
                  >
                    <Text size="xs">{t(`invoices.vat.category.${category}`)}</Text>
                  </Pressable>
                ))}
              </HStack>
            </FormControl>

            {item.vatCategory === "normal" ? (
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t("invoices.lineItemEditor.vatRate")}</FormControlLabelText>
                </FormControlLabel>
                <HStack space="sm">
                  {VAT_RATES.map((rate: VatRate) => (
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
            ) : (
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t("invoices.vat.reasonLabel")}</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    placeholder={reasonPreview ?? t("invoices.vat.reasonPlaceholder")}
                    value={item.vatExemptionReason ?? ""}
                    onChangeText={(value) =>
                      updateItem(item.id, { vatExemptionReason: value || undefined })
                    }
                  />
                </Input>
              </FormControl>
            )}

            <Text size="sm" className="text-muted-foreground">
              {t("invoices.lineItemEditor.lineTotal")}: {formatCurrency(lineItemGrossTotal(item), currency)}
              {isExempt ? ` · ${reasonPreview}` : ""}
            </Text>
          </VStack>
        );
      })}

      <Button variant="outline" onPress={addItem}>
        <ButtonText>{t("invoices.lineItemEditor.addLineItem")}</ButtonText>
      </Button>
    </VStack>
  );
}
