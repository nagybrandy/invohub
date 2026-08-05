// app/login.tsx
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { authClient } from "@/lib/auth-client";
import { routes } from "@/lib/navigation";
import { SIGNUP_ROLES, type SignupRole } from "@/lib/user-roles";

export default function Login() {
  const { t } = useTranslation();
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<SignupRole>("entrepreneur");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const result = isSignup
        ? await authClient.signUp.email({
            name,
            email,
            password,
            role,
          } as Parameters<typeof authClient.signUp.email>[0])
        : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message ?? t("common.error"));
        return;
      }
      router.replace(routes.dashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Box className="flex-1 items-center justify-center px-6 py-8">
        <Card className="w-full max-w-md p-8">
          <VStack space="lg">
            <VStack space="xs">
              <Heading size="xl">
                {isSignup ? t("auth.createAccount") : t("auth.welcomeBack")}
              </Heading>
              <Text size="sm" className="font-light text-muted-foreground">
                {isSignup ? t("auth.signUpSubtitle") : t("auth.signInSubtitle")}
              </Text>
            </VStack>

            <VStack space="md">
              {isSignup ? (
                <>
                  <FormControl>
                    <FormControlLabel>
                      <FormControlLabelText>{t("auth.name")}</FormControlLabelText>
                    </FormControlLabel>
                    <Input>
                      <InputField
                        placeholder="Kovács Anna"
                        autoCapitalize="words"
                        value={name}
                        onChangeText={setName}
                        className="font-light"
                      />
                    </Input>
                  </FormControl>

                  <FormControl>
                    <FormControlLabel>
                      <FormControlLabelText>
                        {t("auth.accountType")}
                      </FormControlLabelText>
                    </FormControlLabel>
                    <VStack space="sm">
                      {SIGNUP_ROLES.map((r) => (
                        <Pressable
                          key={r}
                          onPress={() => setRole(r)}
                          className={`rounded-lg border p-3 ${
                            role === r
                              ? "border-primary bg-primary/10"
                              : "border-border bg-card"
                          }`}
                        >
                          <Text className="font-medium">
                            {t(`roles.${r}`)}
                          </Text>
                          <Text size="xs" className="font-light text-muted-foreground">
                            {t(`roles.${r}Hint`)}
                          </Text>
                        </Pressable>
                      ))}
                    </VStack>
                  </FormControl>
                </>
              ) : null}

              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t("auth.email")}</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    placeholder="te@pelda.hu"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    className="font-light"
                  />
                </Input>
              </FormControl>

              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>
                    {t("auth.password")}
                  </FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    placeholder="••••••••"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    className="font-light"
                  />
                </Input>
              </FormControl>

              {error ? (
                <Text size="sm" className="text-destructive">
                  {error}
                </Text>
              ) : null}

              <Button onPress={handleSubmit} disabled={loading}>
                {loading ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonText>
                    {isSignup ? t("auth.signUp") : t("auth.signIn")}
                  </ButtonText>
                )}
              </Button>
            </VStack>

            <Pressable
              onPress={() => {
                setError(null);
                setMode(isSignup ? "signin" : "signup");
              }}
              className="items-center py-1"
            >
              <Text size="sm" className="text-primary">
                {isSignup
                  ? t("auth.alreadyHaveAccount")
                  : t("auth.noAccount")}
              </Text>
            </Pressable>
          </VStack>
        </Card>

        <Pressable onPress={() => router.push(routes.home)} className="mt-4 py-2">
          <Text size="sm" className="text-muted-foreground">
            {t("auth.backToHome")}
          </Text>
        </Pressable>
      </Box>
    </SafeAreaView>
  );
}
