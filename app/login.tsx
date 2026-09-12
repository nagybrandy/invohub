// app/login.tsx
// Auth screen: navy marketing shell, Ranade wordmark, HU/EN switcher, sign-in/up form.
import * as React from "react";
import { ScrollView, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandLogo } from "@/components/marketing/BrandLogo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
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
import { VStack } from "@/components/ui/vstack";
import { authClient } from "@/lib/auth-client";
import { routes } from "@/lib/navigation";
import { SIGNUP_ROLES, type SignupRole } from "@/lib/user-roles";

export default function Login() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
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

  const form = (
    <VStack space="lg" className="w-full">
      <VStack space="xs">
        <Heading size="xl" className="font-heading text-foreground">
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
                  accessibilityLabel={t("auth.name")}
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
                <FormControlLabelText>{t("auth.accountType")}</FormControlLabelText>
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
                    <Text className="font-medium">{t(`roles.${r}`)}</Text>
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
              accessibilityLabel={t("auth.email")}
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
            <FormControlLabelText>{t("auth.password")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField
              accessibilityLabel={t("auth.password")}
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

        <Button onPress={handleSubmit} disabled={loading} size="lg">
          {loading ? (
            <ButtonSpinner />
          ) : (
            <ButtonText>{isSignup ? t("auth.signUp") : t("auth.signIn")}</ButtonText>
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
          {isSignup ? t("auth.alreadyHaveAccount") : t("auth.noAccount")}
        </Text>
      </Pressable>
    </VStack>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0b1533]" edges={["top", "bottom"]}>
      <Box className="absolute right-4 top-4 z-10 md:right-8 md:top-6">
        <LanguageSwitcher tone="onDark" />
      </Box>

      {isDesktop ? (
        <HStack className="min-h-full flex-1">
          <Box className="flex-1 justify-between px-12 py-14">
            <Pressable onPress={() => router.push(routes.home)}>
              <BrandLogo tone="onDark" height={36} />
            </Pressable>
            <VStack space="md" className="max-w-md">
              <Text className="font-heading text-4xl font-bold leading-tight tracking-tight text-white">
                {t("auth.heroTitle")}
              </Text>
              <Text className="text-base font-light leading-relaxed text-white/70">
                {t("auth.heroSubtitle")}
              </Text>
            </VStack>
            <Text size="xs" className="text-white/45">
              {t("auth.evPriorityNote")}
            </Text>
          </Box>
          <Box className="w-full max-w-xl justify-center bg-background px-10 py-12">
            <Card className="border-0 bg-transparent p-0 shadow-none">{form}</Card>
            <Pressable onPress={() => router.push(routes.home)} className="mt-6 py-2">
              <Text size="sm" className="text-muted-foreground">
                {t("auth.backToHome")}
              </Text>
            </Pressable>
          </Box>
        </HStack>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow justify-center px-5 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <VStack space="lg" className="mx-auto w-full max-w-md">
            <Pressable onPress={() => router.push(routes.home)} className="self-start">
              <BrandLogo tone="onDark" height={32} />
            </Pressable>
            <Card className="rounded-2xl border-border/60 p-6">{form}</Card>
            <Pressable onPress={() => router.push(routes.home)} className="items-center py-2">
              <Text size="sm" className="text-white/60">
                {t("auth.backToHome")}
              </Text>
            </Pressable>
          </VStack>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
