// app/forgot-password.tsx
// "Elfelejtett jelszó?": asks Better Auth to mail a reset link. The answer is
// the same whether or not the address has an account — the form must not be
// usable to find out who has one.
import * as React from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { authClient } from "@/lib/auth-client";
import { getAuthBaseUrl } from "@/lib/auth-url";
import { routes } from "@/lib/navigation";

/** Where the mailed link lands after Better Auth validated the token. */
export function resetPasswordRedirectUrl(): string {
  const origin =
    Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : getAuthBaseUrl();
  return `${origin}${routes.resetPassword as string}`;
}

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit() {
    const value = email.trim();
    if (!value) return;
    setSending(true);
    setError(null);
    try {
      const result = await authClient.requestPasswordReset({ email: value, redirectTo: resetPasswordRedirectUrl() });
      if (result.error) throw new Error(result.error.message ?? "request failed");
      setSent(true);
    } catch {
      setError(t("auth.reset.requestFailed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <ScreenLayout width="form" header={<Heading size="2xl">{t("auth.reset.requestTitle")}</Heading>}>
      <VStack space="md">
        <Text size="sm" className="text-muted-foreground">
          {t("auth.reset.requestSubtitle")}
        </Text>
        {sent ? (
          <Text size="sm" className="text-foreground" testID="forgot-password-sent">
            {t("auth.reset.requestSent")}
          </Text>
        ) : (
          <>
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t("auth.email")}</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t("auth.emailPlaceholder")}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  testID="forgot-password-email"
                />
              </Input>
            </FormControl>
            {error ? (
              <Text size="sm" className="text-destructive">
                {error}
              </Text>
            ) : null}
            <Button onPress={() => void handleSubmit()} disabled={sending || !email.trim()} testID="forgot-password-submit">
              {sending ? <ButtonSpinner /> : null}
              <ButtonText>{t("auth.reset.requestAction")}</ButtonText>
            </Button>
          </>
        )}
        <Pressable onPress={() => router.push(routes.login)} className="self-start py-2">
          <Text size="sm" className="text-primary">
            {t("auth.reset.backToLogin")}
          </Text>
        </Pressable>
      </VStack>
    </ScreenLayout>
  );
}
