// app/login.tsx
// Email + password auth screen (sign in / sign up) built entirely from shadcn primitives.
import * as React from "react";
import { ActivityIndicator, View } from "react-native";
import { router, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";

export default function Login() {
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const result = isSignup
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message ?? "Authentication failed.");
        return;
      }
      router.replace("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{isSignup ? "Create account" : "Welcome back"}</CardTitle>
            <CardDescription>
              {isSignup
                ? "Sign up to start invoicing with InvoHub."
                : "Sign in to your InvoHub account."}
            </CardDescription>
          </CardHeader>

          <CardContent className="gap-4">
            {isSignup ? (
              <View className="gap-1.5">
                <Label nativeID="name">Name</Label>
                <Input
                  aria-labelledby="name"
                  placeholder="Jane Doe"
                  autoCapitalize="words"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            ) : null}

            <View className="gap-1.5">
              <Label nativeID="email">Email</Label>
              <Input
                aria-labelledby="email"
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View className="gap-1.5">
              <Label nativeID="password">Password</Label>
              <Input
                aria-labelledby="password"
                placeholder="••••••••"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {error ? (
              <Text className="text-sm text-destructive">{error}</Text>
            ) : null}

            <Button onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text>{isSignup ? "Sign up" : "Sign in"}</Text>
              )}
            </Button>
          </CardContent>

          <CardFooter className="justify-center">
            <Button
              variant="link"
              size="sm"
              onPress={() => {
                setError(null);
                setMode(isSignup ? "signin" : "signup");
              }}
            >
              <Text>
                {isSignup
                  ? "Already have an account? Sign in"
                  : "No account? Create one"}
              </Text>
            </Button>
          </CardFooter>
        </Card>

        <Link href="/" asChild>
          <Button variant="ghost" size="sm" className="mt-4">
            <Text>Back to home</Text>
          </Button>
        </Link>
      </View>
    </SafeAreaView>
  );
}
