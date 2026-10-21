// app/invite.tsx
// Landing page of the e-mailed invitation link: /invite?token=…
// Signed in → accept (the invitation is addressed to one e-mail address; the
// server checks it). Not signed in → remember the token, send them to sign in
// or register, and pick it up again right after.
import * as React from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Box } from "@/components/ui/box";
import { ApiError, apiFetch } from "@/lib/api/client";
import { useSession } from "@/lib/auth-client";
import { routes } from "@/lib/navigation";
import { clearPendingInvite, rememberPendingInvite } from "@/lib/workspaces/pending-invite";
import { setActiveAccountId } from "@/lib/workspaces/active-client";

type State = { kind: "loading" } | { kind: "needLogin" } | { kind: "accepted"; name: string } | { kind: "error"; code: string };

export default function InviteScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const { data: session, isPending } = useSession();
  const inviteToken = Array.isArray(token) ? token[0] : token;
  const [state, setState] = React.useState<State>({ kind: "loading" });

  React.useEffect(() => {
    if (isPending) return;
    if (!inviteToken) {
      setState({ kind: "error", code: "notFound" });
      return;
    }
    if (!session) {
      rememberPendingInvite(inviteToken);
      setState({ kind: "needLogin" });
      return;
    }
    let cancelled = false;
    apiFetch<{ accountId: string; accountName: string }>("/api/workspaces/invites/accept", {
      method: "POST",
      body: JSON.stringify({ token: inviteToken }),
    })
      .then((res) => {
        if (cancelled) return;
        clearPendingInvite();
        // Work in the newly shared account straight away.
        setActiveAccountId(res.accountId);
        setState({ kind: "accepted", name: res.accountName });
      })
      .catch((e) => {
        if (cancelled) return;
        clearPendingInvite();
        setState({ kind: "error", code: e instanceof ApiError && e.code ? e.code : "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken, session, isPending]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Box className="flex-1 items-center justify-center px-6 py-8">
        <Card className="w-full max-w-md p-6">
          <VStack space="md">
            <Heading size="lg">{t("invite.title")}</Heading>
            {state.kind === "loading" ? <Text className="text-muted-foreground">{t("common.loading")}</Text> : null}
            {state.kind === "needLogin" ? (
              <>
                <Text className="text-foreground">{t("invite.needLogin")}</Text>
                <Button onPress={() => router.replace(routes.login)} testID="invite-login">
                  <ButtonText>{t("auth.signIn")}</ButtonText>
                </Button>
              </>
            ) : null}
            {state.kind === "accepted" ? (
              <>
                <Text className="text-foreground" testID="invite-accepted">{t("invite.accepted", { name: state.name })}</Text>
                <Button onPress={() => window.location.assign("/dashboard")} testID="invite-open">
                  <ButtonText>{t("invite.open")}</ButtonText>
                </Button>
              </>
            ) : null}
            {state.kind === "error" ? (
              <>
                <Text className="text-destructive" testID="invite-error">{t(`invite.errors.${state.code}`, { defaultValue: t("invite.errors.failed") })}</Text>
                <Button variant="outline" onPress={() => router.replace(routes.dashboard)}>
                  <ButtonText>{t("invite.toApp")}</ButtonText>
                </Button>
              </>
            ) : null}
          </VStack>
        </Card>
      </Box>
    </SafeAreaView>
  );
}
