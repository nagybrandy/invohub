// app/reset-password.tsx
// Where the mailed link lands (?token=…): the new password is saved through
// Better Auth's resetPassword with that token. Better Auth sends
// ?error=INVALID_TOKEN here when the link is bad or expired.
import * as React from "react";
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
    <ScreenLayout width="form" header={<Heading size="2xl">{t("auth.reset.title")}</Heading>}>
      <VStack space="md">
        {done ? (
          <>
            <Text size="sm" className="text-foreground" testID="reset-password-done">
              {t("auth.reset.done")}
            </Text>
            <Button onPress={() => router.replace(routes.login)} testID="reset-password-to-login">
              <ButtonText>{t("auth.signIn")}</ButtonText>
            </Button>
          </>
        ) : invalidLink ? (
          <>
            <Text size="sm" className="text-destructive" testID="reset-password-invalid">
              {t("auth.reset.invalidLink")}
            </Text>
            <Button variant="outline" onPress={() => router.replace(routes.forgotPassword)}>
              <ButtonText>{t("auth.reset.requestTitle")}</ButtonText>
            </Button>
          </>
        ) : (
          <>
            <Text size="sm" className="text-muted-foreground">
              {t("auth.reset.subtitle")}
            </Text>
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t("auth.reset.newPassword")}</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField value={password} onChangeText={setPassword} secureTextEntry testID="reset-password-new" />
              </Input>
            </FormControl>
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t("auth.reset.confirmPassword")}</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField value={confirm} onChangeText={setConfirm} secureTextEntry testID="reset-password-confirm" />
              </Input>
            </FormControl>
            {error ? (
              <Text size="sm" className="text-destructive">
                {error}
              </Text>
            ) : null}
            <Button onPress={() => void handleSubmit()} disabled={saving} testID="reset-password-submit">
              {saving ? <ButtonSpinner /> : null}
              <ButtonText>{t("auth.reset.action")}</ButtonText>
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
