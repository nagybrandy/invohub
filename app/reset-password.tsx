// app/reset-password.tsx
// Where the mailed link lands (?token=…): the new password is saved through
// Better Auth's resetPassword with that token. Better Auth sends
// ?error=INVALID_TOKEN here when the link is bad or expired.
import * as React from "react";
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
import { validateNewPassword } from "@/lib/auth-password-rules";
import { routes } from "@/lib/navigation";
import { useRouteParam } from "@/lib/routing/route-param";

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const token = useRouteParam("token");
  const linkError = useRouteParam("error");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const invalidLink = !token || !!linkError;

  async function handleSubmit() {
    const problem = validateNewPassword(password, confirm);
    if (problem) {
      setError(t(`auth.reset.${problem}`));
      return;
    }
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) throw new Error(result.error.message ?? "reset failed");
      setDone(true);
    } catch {
      setError(t("auth.reset.failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout>
      <VStack space="lg">
        <AuthCardHeader
          title={t("auth.reset.title")}
          subtitle={done || invalidLink ? undefined : t("auth.reset.subtitle")}
        />
        {done ? (
          <>
            <AuthNote tone="ok" testID="reset-password-done">
              {t("auth.reset.done")}
            </AuthNote>
            <Button size="lg" onPress={() => router.replace(routes.login)} testID="reset-password-to-login">
              <ButtonText>{t("auth.signIn")}</ButtonText>
            </Button>
          </>
        ) : invalidLink ? (
          <>
            <AuthNote tone="err" testID="reset-password-invalid">
              {t("auth.reset.invalidLink")}
            </AuthNote>
            <Button
              size="lg"
              variant="secondary"
              onPress={() => router.replace(routes.forgotPassword)}
              testID="reset-password-request-new"
            >
              <ButtonText>{t("auth.reset.requestTitle")}</ButtonText>
            </Button>
          </>
        ) : (
          <VStack space="md">
            <FormField label={t("auth.reset.newPassword")}>
              <Input>
                <InputField
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  testID="reset-password-new"
                />
              </Input>
            </FormField>
            <FormField label={t("auth.reset.confirmPassword")}>
              <Input>
                <InputField
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  autoComplete="new-password"
                  testID="reset-password-confirm"
                />
              </Input>
            </FormField>
            {error ? (
              <AuthNote tone="err" testID="reset-password-error">
                {error}
              </AuthNote>
            ) : null}
            <Button
              size="lg"
              onPress={() => void handleSubmit()}
              disabled={saving}
              testID="reset-password-submit"
            >
              {saving ? <ButtonSpinner /> : null}
              <ButtonText>{t("auth.reset.action")}</ButtonText>
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
