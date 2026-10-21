// app/(app)/settings/access.tsx
// Számlázófiókok és hozzáférés: switch between billing accounts, create a new
// one, and — for the account you are in — invite an accountant or colleague,
// change roles, withdraw access.
import * as React from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { OptionChips } from "@/components/settings/OptionChips";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { ApiError, apiFetch } from "@/lib/api/client";
import { confirmAsync } from "@/lib/ui/confirm";
import { INVITABLE_ROLES, canManageAccess, type InvitableRole } from "@/lib/workspaces/permissions";
import type { InviteSummary, MemberRow } from "@/lib/workspaces/service";

export default function AccessSettingsScreen() {
  const { t } = useTranslation();
  const workspaces = useWorkspaces();
  const { accounts, active, role, loading } = workspaces;

  const [members, setMembers] = React.useState<MemberRow[]>([]);
  const [invites, setInvites] = React.useState<InviteSummary[]>([]);
  const [newName, setNewName] = React.useState("");
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<InvitableRole>("accountant");
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const mayManage = canManageAccess(role);

  const loadAccess = React.useCallback(async () => {
    if (!mayManage) {
      setMembers([]);
      setInvites([]);
      return;
    }
    try {
      const [m, i] = await Promise.all([
        apiFetch<{ members: MemberRow[] }>("/api/workspaces/members"),
        apiFetch<{ invites: InviteSummary[] }>("/api/workspaces/invites"),
      ]);
      setMembers(m.members);
      setInvites(i.invites);
    } catch {
      setMessage({ kind: "error", text: t("accounts.loadFailed") });
    }
  }, [mayManage, t]);

  React.useEffect(() => {
    if (!loading) void loadAccess();
  }, [loading, loadAccess, active?.id]);

  const fail = (e: unknown) => {
    const code = e instanceof ApiError ? e.code : undefined;
    setMessage({ kind: "error", text: code ? t(`accounts.errors.${code}`, { defaultValue: t("accounts.failed") }) : t("accounts.failed") });
  };

  async function handleCreate() {
    if (newName.trim().length < 2) return;
    setBusy(true);
    setMessage(null);
    try {
      const ws = await workspaces.create(newName.trim());
      setNewName("");
      setMessage({ kind: "ok", text: t("accounts.created", { name: ws.name }) });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite() {
    setBusy(true);
    setMessage(null);
    setLastInviteUrl(null);
    try {
      const res = await apiFetch<{ inviteUrl: string; emailSent: boolean }>("/api/workspaces/invites", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setInviteEmail("");
      setLastInviteUrl(res.inviteUrl);
      setMessage({ kind: "ok", text: res.emailSent ? t("accounts.inviteSent") : t("accounts.inviteNotSent") });
      await loadAccess();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(member: MemberRow) {
    const ok = await confirmAsync({
      title: t("accounts.removeTitle"),
      message: t("accounts.removeMessage", { name: member.name }),
      confirmLabel: t("accounts.remove"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/workspaces/members/${member.accessId}`, { method: "DELETE" });
      await loadAccess();
    } catch (e) {
      fail(e);
    }
  }

  async function handleRole(member: MemberRow, next: InvitableRole) {
    try {
      await apiFetch(`/api/workspaces/members/${member.accessId}`, { method: "PATCH", body: JSON.stringify({ role: next }) });
      await loadAccess();
    } catch (e) {
      fail(e);
    }
  }

  async function handleRevoke(invite: InviteSummary) {
    try {
      await apiFetch(`/api/workspaces/invites/${invite.id}`, { method: "DELETE" });
      await loadAccess();
    } catch (e) {
      fail(e);
    }
  }

  async function handleLeave(accountId: string) {
    const ok = await confirmAsync({
      title: t("accounts.leaveTitle"),
      message: t("accounts.leaveMessage"),
      confirmLabel: t("accounts.leave"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiFetch("/api/workspaces/leave", { method: "POST", body: JSON.stringify({ accountId }) });
      if (accountId === active?.id) workspaces.switchTo(null);
      else await workspaces.refresh();
    } catch (e) {
      fail(e);
    }
  }

  const roleOptions = INVITABLE_ROLES.map((value) => ({ value, label: t(`accounts.roles.${value}`) }));

  return (
    <ScreenLayout header={<Heading size="2xl">{t("accounts.pageTitle")}</Heading>}>
      <VStack space="lg">
        <Text size="sm" className="text-muted-foreground">{t("accounts.pageSubtitle")}</Text>

        <Card className="p-4" testID="accounts-list">
          <VStack space="md">
            <Heading size="md">{t("accounts.yourAccounts")}</Heading>
            {accounts.map((account) => (
              <HStack key={account.id} className="items-center justify-between gap-3 border-b border-subtle pb-2">
                <VStack className="flex-1">
                  <Text className="font-medium text-foreground">{account.name}</Text>
                  <Text size="xs" className="text-muted-foreground">
                    {account.isOwn ? t("accounts.own") : t(`accounts.roles.${account.role}`)}
                  </Text>
                </VStack>
                {account.id === active?.id ? (
                  <Text size="xs" className="font-semibold text-primary">{t("accounts.current")}</Text>
                ) : (
                  <Button size="sm" variant="outline" onPress={() => workspaces.switchTo(account.isOwn ? null : account.id)} testID={`account-switch-${account.id}`}>
                    <ButtonText>{t("accounts.switchTo")}</ButtonText>
                  </Button>
                )}
                {!account.isOwn && account.role !== "owner" ? (
                  <Pressable onPress={() => void handleLeave(account.id)} accessibilityRole="button">
                    <Text size="xs" className="text-destructive">{t("accounts.leave")}</Text>
                  </Pressable>
                ) : null}
              </HStack>
            ))}

            <VStack space="xs">
              <Text size="sm" className="font-medium text-foreground">{t("accounts.newAccount")}</Text>
              <Text size="xs" className="text-muted-foreground">{t("accounts.newAccountHint")}</Text>
              <HStack space="sm" className="items-center">
                <Input className="flex-1">
                  <InputField testID="account-new-name" value={newName} onChangeText={setNewName} placeholder={t("accounts.newAccountPlaceholder")} />
                </Input>
                <Button onPress={() => void handleCreate()} disabled={busy || newName.trim().length < 2} testID="account-create">
                  <ButtonText>{t("accounts.create")}</ButtonText>
                </Button>
              </HStack>
            </VStack>
          </VStack>
        </Card>

        {active ? (
          <Card className="p-4" testID="accounts-access">
            <VStack space="md">
              <VStack space="xs">
                <Heading size="md">{t("accounts.accessTitle", { name: active.name })}</Heading>
                <Text size="xs" className="text-muted-foreground">{t("accounts.accessHint")}</Text>
              </VStack>

              {!mayManage ? (
                <Text size="sm" className="text-muted-foreground">{t("accounts.noManage", { role: t(`accounts.roles.${role}`) })}</Text>
              ) : (
                <>
                  <VStack space="xs">
                    {members.map((member) => (
                      <HStack key={member.accessId} className="flex-wrap items-center justify-between gap-2 border-b border-subtle pb-2">
                        <VStack className="min-w-[180px] flex-1">
                          <Text className="text-foreground">
                            {member.name}
                            {member.isYou ? ` (${t("accounts.you")})` : ""}
                          </Text>
                          <Text size="xs" className="text-muted-foreground">{member.email}</Text>
                        </VStack>
                        {member.role === "owner" ? (
                          <Text size="sm" className="text-muted-foreground">{t("accounts.roles.owner")}</Text>
                        ) : (
                          <HStack space="sm" className="items-center">
                            <OptionChips
                              testIDPrefix={`member-role-${member.accessId}`}
                              value={member.role as InvitableRole}
                              onChange={(next) => next && void handleRole(member, next)}
                              options={roleOptions}
                            />
                            <Pressable onPress={() => void handleRemove(member)} accessibilityRole="button" testID={`member-remove-${member.accessId}`}>
                              <Text size="xs" className="text-destructive">{t("accounts.remove")}</Text>
                            </Pressable>
                          </HStack>
                        )}
                      </HStack>
                    ))}
                  </VStack>

                  {invites.length > 0 ? (
                    <VStack space="xs">
                      <Text size="sm" className="font-medium text-foreground">{t("accounts.pendingInvites")}</Text>
                      {invites.map((invite) => (
                        <HStack key={invite.id} className="items-center justify-between gap-2">
                          <Text size="sm" className="flex-1 text-foreground">
                            {invite.email} · {t(`accounts.roles.${invite.role}`)}
                          </Text>
                          <Pressable onPress={() => void handleRevoke(invite)} accessibilityRole="button">
                            <Text size="xs" className="text-destructive">{t("accounts.revoke")}</Text>
                          </Pressable>
                        </HStack>
                      ))}
                    </VStack>
                  ) : null}

                  <VStack space="sm">
                    <Text size="sm" className="font-medium text-foreground">{t("accounts.invite")}</Text>
                    <Input>
                      <InputField
                        testID="invite-email"
                        value={inviteEmail}
                        onChangeText={setInviteEmail}
                        placeholder={t("accounts.invitePlaceholder")}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </Input>
                    <OptionChips testIDPrefix="invite-role" value={inviteRole} onChange={(r) => r && setInviteRole(r)} options={roleOptions} />
                    <Text size="xs" className="text-muted-foreground">{t(`accounts.roleHint.${inviteRole}`)}</Text>
                    <Button onPress={() => void handleInvite()} disabled={busy || !inviteEmail.includes("@")} testID="invite-send">
                      <ButtonText>{t("accounts.sendInvite")}</ButtonText>
                    </Button>
                    {lastInviteUrl ? (
                      <VStack space="xs">
                        <Text size="xs" className="text-muted-foreground">{t("accounts.inviteLink")}</Text>
                        <Text size="xs" selectable className="font-mono text-foreground" testID="invite-url">{lastInviteUrl}</Text>
                        {Platform.OS === "web" ? (
                          <Pressable onPress={() => void navigator.clipboard?.writeText(lastInviteUrl)} accessibilityRole="button">
                            <Text size="xs" className="font-medium text-primary">{t("accounts.copyLink")}</Text>
                          </Pressable>
                        ) : null}
                      </VStack>
                    ) : null}
                  </VStack>
                </>
              )}
            </VStack>
          </Card>
        ) : null}

        {message ? (
          <Text size="sm" className={message.kind === "ok" ? "text-green-600" : "text-destructive"} testID="accounts-message">
            {message.text}
          </Text>
        ) : null}
      </VStack>
    </ScreenLayout>
  );
}
