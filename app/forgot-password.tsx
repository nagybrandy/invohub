// app/forgot-password.tsx
// "Elfelejtett jelszó?": asks Better Auth to mail a reset link. The answer is
// the same whether or not the address has an account — the form must not be
// usable to find out who has one.
import * as React from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { AuthCardHeader, AuthLayout, AuthNote } from "@/components/auth/AuthLayout";
import { FormField } from "@/components/layout/FormField";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
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
    <AuthLayout>
      <VStack space="lg">
        <AuthCardHeader
          title={t("auth.reset.requestTitle")}
          subtitle={t("auth.reset.requestSubtitle")}
        />
        {sent ? (
          <AuthNote tone="ok" testID="forgot-password-sent">
            {t("auth.reset.requestSent")}
          </AuthNote>
        ) : (
          <VStack space="md">
            <FormField label={t("auth.email")}>
              <Input>
                <InputField
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t("auth.emailPlaceholder")}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  testID="forgot-password-email"
                />
              </Input>
            </FormField>
            {error ? (
              <AuthNote tone="err" testID="forgot-password-error">
                {error}
              </AuthNote>
            ) : null}
            <Button
              size="lg"
              onPress={() => void handleSubmit()}
              disabled={sending || !email.trim()}
              testID="forgot-password-submit"
            >
              {sending ? <ButtonSpinner /> : null}
              <ButtonText>{t("auth.reset.requestAction")}</ButtonText>
            </Button>
          </VStack>
        )}
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push(routes.login)}
          className="min-h-10 items-center justify-center rounded-control"
          testID="auth-back-to-login"
        >
          <Text className="text-sm font-medium text-primary">{t("auth.reset.backToLogin")}</Text>
        </Pressable>
      </VStack>
    </AuthLayout>
  );
}
