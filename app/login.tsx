// app/login.tsx
// Auth screen: AuthLayout (navy hero panel / stacked), segmented sign-in / sign-up card.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { AuthCardHeader, AuthLayout, AuthNote } from "@/components/auth/AuthLayout";
import { FormField } from "@/components/layout/FormField";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { apiFetch } from "@/lib/api/client";
import { authClient } from "@/lib/auth-client";
import { isCompanyProfileComplete } from "@/lib/companies/completeness";
import type { PublicCompany } from "@/lib/companies/public-company";
import { routes } from "@/lib/navigation";
import { SIGNUP_ROLES, type SignupRole } from "@/lib/user-roles";

export default function Login() {
  const { t } = useTranslation();
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [signupRole, setSignupRole] = React.useState<SignupRole>("entrepreneur");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      // The chosen account type is sent as `signupRole` — a non-authoritative
      // field the server clamps to entrepreneur/accountant before it can
      // ever influence the real `role` (see lib/auth.ts databaseHooks).
      const result = isSignup
        ? await authClient.signUp.email({ name, email, password, signupRole })
        : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message ?? t("common.error"));
        return;
      }

      // A new (or still-incomplete) company profile blocks finalizing an
      // invoice server-side (lib/companies/completeness.ts) — send the
      // user to onboarding to fill it in now instead of letting them
      // discover that later, mid-composer.
      try {
        const { company } = await apiFetch<{ company: PublicCompany | null }>("/api/companies");
        if (!isCompanyProfileComplete(company)) {
          router.replace(routes.onboarding);
          return;
        }
      } catch {
        // The profile check itself failing should never block sign-in —
        // fall through to the dashboard exactly as before this check existed.
      }

      router.replace(routes.dashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: "signin" | "signup") {
    if (next === mode) return;
    setError(null);
    setMode(next);
  }

  return (
    <AuthLayout>
      <VStack className="w-full gap-6">
        <SegmentedControl
          fullWidth
          outlined
          value={mode}
          onChange={switchMode}
          accessibilityLabel={`${t("auth.signIn")} / ${t("auth.signUp")}`}
          testID="login-mode"
          options={[
            { value: "signin", label: t("auth.signIn"), testID: "login-mode-signin" },
            { value: "signup", label: t("auth.signUp"), testID: "login-mode-signup" },
          ]}
        />

        <AuthCardHeader
          title={isSignup ? t("auth.createAccount") : t("auth.welcomeBack")}
          subtitle={isSignup ? t("auth.signUpSubtitle") : t("auth.signInSubtitle")}
        />

        <VStack space="md">
          {isSignup ? (
            <>
              <FormField label={t("auth.name")}>
                <Input>
                  <InputField
                    accessibilityLabel={t("auth.name")}
                    placeholder={t("auth.namePlaceholder")}
                    autoCapitalize="words"
                    autoComplete="name"
                    value={name}
                    onChangeText={setName}
                  />
                </Input>
              </FormField>

              <FormField label={t("auth.accountType")}>
                <Box className="flex-row gap-2" testID="signup-role-picker" accessibilityRole="radiogroup">
                  {SIGNUP_ROLES.map((role) => {
                    const selected = signupRole === role;
                    return (
                      <Pressable
                        key={role}
                        accessibilityRole="radio"
                        accessibilityState={{ selected, checked: selected }}
                        onPress={() => setSignupRole(role)}
                        testID={`signup-role-${role}`}
                        className={`min-w-0 flex-1 rounded-control border p-3 ${
                          selected
                            ? "border-primary bg-primary-wash"
                            : "border-line-strong bg-surface web:hover:bg-neutral-wash"
                        }`}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            selected ? "text-primary-ink" : "text-ink"
                          }`}
                        >
                          {t(`roles.${role}`)}
                        </Text>
                        <Text className="mt-1 text-xs text-muted-ink">
                          {t(`roles.${role}Hint`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </Box>
              </FormField>
            </>
          ) : null}

          <FormField label={t("auth.email")}>
            <Input>
              <InputField
                accessibilityLabel={t("auth.email")}
                placeholder={t("auth.emailPlaceholder")}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </Input>
          </FormField>

          <FormField label={t("auth.password")}>
            <Input>
              <InputField
                accessibilityLabel={t("auth.password")}
                placeholder="••••••••"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </Input>
          </FormField>

          {!isSignup ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(routes.forgotPassword)}
              className="min-h-8 items-end justify-center self-end rounded-control"
              testID="login-forgot-password"
            >
              <Text className="text-sm font-medium text-primary">{t("auth.forgotPassword")}</Text>
            </Pressable>
          ) : null}

          {error ? <AuthNote tone="err" testID="login-error">{error}</AuthNote> : null}

          <Button onPress={handleSubmit} disabled={loading} size="lg" testID="login-submit">
            {loading ? (
              <ButtonSpinner />
            ) : (
              <ButtonText>{isSignup ? t("auth.signUp") : t("auth.signIn")}</ButtonText>
            )}
          </Button>
        </VStack>

        <Pressable
          accessibilityRole="button"
          onPress={() => switchMode(isSignup ? "signin" : "signup")}
          className="min-h-10 items-center justify-center rounded-control"
          testID="login-switch-mode"
        >
          <Text className="text-sm font-medium text-primary">
            {isSignup ? t("auth.alreadyHaveAccount") : t("auth.noAccount")}
          </Text>
        </Pressable>
      </VStack>
    </AuthLayout>
  );
}
