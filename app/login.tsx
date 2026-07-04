// app/login.tsx
// Email + password auth with role selection for accountants vs entrepreneurs.
import * as React from "react";
import { router } from "expo-router";
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
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { authClient } from "@/lib/auth-client";
import { routes } from "@/lib/navigation";
import { SIGNUP_ROLES, type SignupRole } from "@/lib/user-roles";

export default function Login() {
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
        setError(result.error.message ?? "Authentication failed.");
        return;
      }
      router.replace(routes.dashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Box className="flex-1 items-center justify-center px-6 py-8">
        <Card className="w-full max-w-md p-6">
          <VStack space="lg">
            <VStack space="xs">
              <Heading size="xl">
                {isSignup ? "Create account" : "Welcome back"}
              </Heading>
              <Text size="sm" className="text-muted-foreground">
                {isSignup
                  ? "InvoHub for Hungarian invoicing, NAV compliance, and bookkeeping."
                  : "Sign in to your InvoHub account."}
              </Text>
            </VStack>

            <VStack space="md">
              {isSignup ? (
                <>
                  <FormControl>
                    <FormControlLabel>
                      <FormControlLabelText>Name</FormControlLabelText>
                    </FormControlLabel>
                    <Input>
                      <InputField
                        placeholder="Kovács Anna"
                        autoCapitalize="words"
                        value={name}
                        onChangeText={setName}
                      />
                    </Input>
                  </FormControl>

                  <FormControl>
                    <FormControlLabel>
                      <FormControlLabelText>Account type</FormControlLabelText>
                    </FormControlLabel>
                    <VStack space="sm">
                      {SIGNUP_ROLES.map((r) => (
                        <Pressable
                          key={r}
                          onPress={() => setRole(r)}
                          className={`rounded-lg border p-3 ${
                            role === r ? "border-primary bg-accent" : "border-border bg-card"
                          }`}
                        >
                          <Text className="font-medium capitalize">{r}</Text>
                          <Text size="xs" className="text-muted-foreground">
                            {r === "accountant"
                              ? "Manage multiple clients, products, and full workflows."
                              : "Invoice for your own business — simplified navigation."}
                          </Text>
                        </Pressable>
                      ))}
                    </VStack>
                  </FormControl>
                </>
              ) : null}

              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Email</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                </Input>
              </FormControl>

              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Password</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    placeholder="••••••••"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
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
                  <ButtonText>{isSignup ? "Sign up" : "Sign in"}</ButtonText>
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
                  ? "Already have an account? Sign in"
                  : "No account? Create one"}
              </Text>
            </Pressable>
          </VStack>
        </Card>

        <Pressable onPress={() => router.push(routes.home)} className="mt-4 py-2">
          <Text size="sm" className="text-muted-foreground">
            Back to home
          </Text>
        </Pressable>
      </Box>
    </SafeAreaView>
  );
}
