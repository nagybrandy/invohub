// app/(app)/settings/pdf.tsx
// Invoice PDF layout settings with live sample preview.
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { FileText } from "lucide-react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { VStack } from "@/components/ui/vstack";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { PdfPreviewEmbed } from "@/components/invoices/PdfPreviewEmbed";
import { usePdfTemplate } from "@/hooks/usePdfTemplate";
import { DEFAULT_PDF_TEMPLATE, PDF_FONT_SCALES } from "@/lib/invoices/pdf-template/defaults";
import type { InvoicePdfTemplate } from "@/lib/invoices/pdf-template/types";
import { sharePdfBlob } from "@/lib/pdf-preview";
import { isWeb } from "@/lib/platform";
import { useIconColors } from "@/lib/theme/icon-colors";

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <HStack className="items-center justify-between">
      <Text size="sm">{label}</Text>
      <Button
        size="sm"
        variant={value ? "default" : "outline"}
        onPress={() => onChange(!value)}
      >
        <ButtonText>{value ? "On" : "Off"}</ButtonText>
      </Button>
    </HStack>
  );
}

export default function PdfSettingsScreen() {
  const icons = useIconColors();
  const { template, loading, save, previewSample } = usePdfTemplate();
  const [draft, setDraft] = React.useState<InvoicePdfTemplate>(DEFAULT_PDF_TEMPLATE);
  const [saving, setSaving] = React.useState(false);
  const [previewing, setPreviewing] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (template) setDraft(template);
  }, [template]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function updateDraft(partial: Partial<InvoicePdfTemplate>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await save(draft);
      setMessage("PDF settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setPreviewing(true);
    setError(null);
    setMessage(null);
    try {
      const blob = await previewSample(draft);
      if (isWeb() && typeof URL !== "undefined") {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } else {
        await sharePdfBlob(blob, "invohub-sample-preview.pdf");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <ScreenLayout
      header={
        <HStack space="sm" className="items-center">
          <FileText size={28} color={icons.foreground} />
          <Heading size="2xl">PDF appearance</Heading>
        </HStack>
      }
    >
      <VStack space="md">
        <Text size="sm" className="text-muted-foreground">
          Customize how generated invoice PDFs look. Preview uses sample data and your company profile.
        </Text>

        {loading ? (
          <ActivityIndicator />
        ) : (
          <>
            <Card className="p-4">
              <VStack space="md">
                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>Document title</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      value={draft.titleText}
                      onChangeText={(v) => updateDraft({ titleText: v })}
                      placeholder="INVOICE"
                    />
                  </Input>
                </FormControl>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>Accent color</FormControlLabelText>
                  </FormControlLabel>
                  <HStack space="sm" className="items-center">
                    <Input className="flex-1">
                      <InputField
                        value={draft.accentColor}
                        onChangeText={(v) => updateDraft({ accentColor: v })}
                        placeholder="#4f46e5"
                        autoCapitalize="none"
                      />
                    </Input>
                    <Pressable
                      className="h-10 w-10 rounded-md border border-border"
                      style={{ backgroundColor: draft.accentColor }}
                    />
                  </HStack>
                </FormControl>

                <VStack space="xs">
                  <Text size="sm" className="font-medium">
                    Font size
                  </Text>
                  <HStack space="sm" className="flex-wrap">
                    {PDF_FONT_SCALES.map((scale) => (
                      <Button
                        key={scale}
                        size="sm"
                        variant={draft.fontScale === scale ? "default" : "outline"}
                        onPress={() => updateDraft({ fontScale: scale })}
                      >
                        <ButtonText className="capitalize">{scale}</ButtonText>
                      </Button>
                    ))}
                  </HStack>
                </VStack>

                <ToggleRow
                  label="Show company block"
                  value={draft.showCompanyBlock}
                  onChange={(v) => updateDraft({ showCompanyBlock: v })}
                />
                <ToggleRow
                  label="Show bank details"
                  value={draft.showBankDetails}
                  onChange={(v) => updateDraft({ showBankDetails: v })}
                />
                <ToggleRow
                  label="Show client tax number"
                  value={draft.showClientTaxNumber}
                  onChange={(v) => updateDraft({ showClientTaxNumber: v })}
                />

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>Notes label</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      value={draft.notesLabel}
                      onChangeText={(v) => updateDraft({ notesLabel: v })}
                      placeholder="Notes"
                    />
                  </Input>
                </FormControl>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>Footer text</FormControlLabelText>
                  </FormControlLabel>
                  <Textarea>
                    <TextareaInput
                      value={draft.footerText}
                      onChangeText={(v) => updateDraft({ footerText: v })}
                      placeholder="Thank you for your business."
                    />
                  </Textarea>
                </FormControl>
              </VStack>
            </Card>

            <HStack space="sm" className="flex-wrap">
              <Button onPress={handleSave} disabled={saving}>
                <ButtonText>{saving ? "Saving…" : "Save settings"}</ButtonText>
              </Button>
              <Button variant="outline" onPress={handlePreview} disabled={previewing}>
                <ButtonText>{previewing ? "Generating…" : "Preview sample PDF"}</ButtonText>
              </Button>
            </HStack>

            {message ? <Text className="text-primary">{message}</Text> : null}
            {error ? <Text className="text-destructive">{error}</Text> : null}

            {previewUrl && isWeb() ? (
              <Card className="overflow-hidden p-0">
                <VStack space="xs" className="border-b border-border p-3">
                  <Text size="sm" className="font-medium">
                    Sample PDF preview
                  </Text>
                  <Text size="xs" className="text-muted-foreground">
                    INV-PREVIEW-001 — sample client and line items
                  </Text>
                </VStack>
                <PdfPreviewEmbed
                  src={previewUrl}
                  title="Sample invoice PDF"
                  minHeight={640}
                />
              </Card>
            ) : null}
          </>
        )}
      </VStack>
    </ScreenLayout>
  );
}
