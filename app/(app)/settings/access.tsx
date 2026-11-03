// app/(app)/settings/access.tsx
// Számlázófiókok és hozzáférés: switch between billing accounts, create a new
// one, and — for the account you are in — invite an accountant or colleague,
// change roles, withdraw access. The logout row closes the page.
import * as React from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/layout/FormField";
import { AccountAvatar } from "@/components/navigation/AccountAvatar";
import { LogoutRow } from "@/components/settings/LogoutRow";
import { OptionChips } from "@/components/settings/OptionChips";
import {
  SettingsNote,
  SettingsPage,
  SettingsSection,
  SettingsSheet,
} from "@/components/settings/SettingsSheet";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { ApiError, apiFetch } from "@/lib/api/client";
import { settingsItemKeys } from "@/lib/settings-navigation";
import { confirmAsync } from "@/lib/ui/confirm";
import { type } from "@/lib/ui/type";
import { INVITABLE_ROLES, canManageAccess, type InvitableRole } from "@/lib/workspaces/permissions";
import type { InviteSummary, MemberRow } from "@/lib/workspaces/service";

export default function AccessSettingsScreen() {
  const { t } = useTranslation();
  const keys = settingsItemKeys("access");
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
    <SettingsPage title={t(keys.title)} lead={t(keys.lead)} testID="settings-access">
      <SettingsSheet>
        <SettingsSection
          title={t("accounts.yourAccounts")}
          hint={t("settingsPages.access.accountsHint")}
          testID="accounts-list"
        >
          <Box className="overflow-hidden rounded-card border border-line">
            {accounts.map((account, index) => (
              <Box
                key={account.id}
                className={`min-h-[62px] flex-row items-center gap-3 px-3.5 py-2.5 ${index > 0 ? "border-t border-line" : ""}`}
              >
                <AccountAvatar id={account.id} name={account.name} active={account.id === active?.id} size={36} />
                <Box className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-sm font-semibold text-ink">
                    {account.name}
                  </Text>
                  <Text numberOfLines={1} className="text-[13px] text-muted-ink">
                    {account.isOwn ? t("accounts.own") : t(`accounts.roles.${account.role}`)}
                  </Text>
                </Box>
                {account.id === active?.id ? (
                  <Text className="rounded-pill bg-ok-wash px-2.5 py-1 text-xs font-bold text-ok">{t("accounts.current")}</Text>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => workspaces.switchTo(account.isOwn ? null : account.id)}
                    testID={`account-switch-${account.id}`}
                  >
                    <ButtonText>{t("accounts.switchTo")}</ButtonText>
                  </Button>
                )}
                {!account.isOwn && account.role !== "owner" ? (
                  <Pressable
                    onPress={() => void handleLeave(account.id)}
                    accessibilityRole="button"
                    className="min-h-10 justify-center px-1"
                  >
                    <Text className="text-[13px] font-semibold text-err">{t("accounts.leave")}</Text>
                  </Pressable>
                ) : null}
              </Box>
            ))}
          </Box>
        </SettingsSection>

        <SettingsSection title={t("accounts.newAccount")} hint={t("accounts.newAccountHint")}>
          <Box className="flex-row gap-2">
            <Input className="min-w-0 flex-1">
              <InputField
                testID="account-new-name"
                accessibilityLabel={t("accounts.newAccount")}
                value={newName}
                onChangeText={setNewName}
                placeholder={t("accounts.newAccountPlaceholder")}
              />
            </Input>
            <Button
              size="form"
              onPress={() => void handleCreate()}
              disabled={busy || newName.trim().length < 2}
              testID="account-create"
            >
              <ButtonText>{t("accounts.create")}</ButtonText>
            </Button>
          </Box>
        </SettingsSection>

        {active ? (
          <SettingsSection
            title={t("accounts.accessTitle", { name: active.name })}
            hint={t("accounts.accessHint")}
            testID="accounts-access"
          >
            {!mayManage ? (
              <Text className={type.meta}>{t("accounts.noManage", { role: t(`accounts.roles.${role}`) })}</Text>
            ) : (
              <>
                <Box className="overflow-hidden rounded-card border border-line">
                  {members.map((member, index) => (
                    <Box
                      key={member.accessId}
                      className={`flex-row flex-wrap items-center gap-3 px-3.5 py-2.5 ${index > 0 ? "border-t border-line" : ""}`}
                    >
                      <AccountAvatar id={member.accessId} name={member.name} round size={36} />
                      <Box className="min-w-[160px] flex-1">
                        <Text numberOfLines={1} className="text-sm font-semibold text-ink">
                          {member.name}
                          {member.isYou ? ` (${t("accounts.you")})` : ""}
                        </Text>
                        <Text numberOfLines={1} className="text-[13px] text-muted-ink">
                          {member.email}
                        </Text>
                      </Box>
                      {member.role === "owner" ? (
                        <Text className="rounded-pill bg-neutral-wash px-2.5 py-1 text-xs font-bold text-muted-ink">
                          {t("accounts.roles.owner")}
                        </Text>
                      ) : (
                        <Box className="flex-row flex-wrap items-center gap-2">
                          <OptionChips
                            testIDPrefix={`member-role-${member.accessId}`}
                            value={member.role as InvitableRole}
                            onChange={(next) => next && void handleRole(member, next)}
                            options={roleOptions}
                          />
                          <Pressable
                            onPress={() => void handleRemove(member)}
                            accessibilityRole="button"
                            testID={`member-remove-${member.accessId}`}
                            className="min-h-10 justify-center px-1"
                          >
                            <Text className="text-[13px] font-semibold text-err">{t("accounts.remove")}</Text>
                          </Pressable>
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>

                {invites.length > 0 ? (
                  <Box className="gap-2">
                    <Text className={type.itemTitle}>{t("accounts.pendingInvites")}</Text>
                    {invites.map((invite) => (
                      <Box key={invite.id} className="flex-row items-center justify-between gap-2">
                        <Text className="min-w-0 flex-1 text-sm text-ink">
                          {invite.email} · {t(`accounts.roles.${invite.role}`)}
                        </Text>
                        <Pressable
                          onPress={() => void handleRevoke(invite)}
                          accessibilityRole="button"
                          className="min-h-10 justify-center px-1"
                        >
                          <Text className="text-[13px] font-semibold text-err">{t("accounts.revoke")}</Text>
                        </Pressable>
                      </Box>
                    ))}
                  </Box>
                ) : null}
              </>
            )}
          </SettingsSection>
        ) : null}

        {active && mayManage ? (
          <SettingsSection
            title={t("accounts.invite")}
            hint={t("settingsPages.access.inviteHint")}
            testID="accounts-invite"
          >
            <FormField label={t("settingsPages.access.emailLabel")}>
              <Input>
                <InputField
                  testID="invite-email"
                  accessibilityLabel={t("settingsPages.access.emailLabel")}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder={t("accounts.invitePlaceholder")}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Input>
            </FormField>
            <FormField label={t("settingsPages.access.roleLabel")} hint={t(`accounts.roleHint.${inviteRole}`)}>
              <Select<InvitableRole>
                testID="invite-role"
                accessibilityLabel={t("settingsPages.access.roleLabel")}
                value={inviteRole}
                options={roleOptions}
                onChange={setInviteRole}
              />
            </FormField>
            <Box className="flex-row">
              <Button onPress={() => void handleInvite()} disabled={busy || !inviteEmail.includes("@")} testID="invite-send">
                <ButtonText>{t("accounts.sendInvite")}</ButtonText>
              </Button>
            </Box>
            {lastInviteUrl ? (
              <Box className="gap-1">
                <Text className={type.meta}>{t("accounts.inviteLink")}</Text>
                <Text selectable className="font-mono text-xs text-ink" testID="invite-url">
                  {lastInviteUrl}
                </Text>
                {Platform.OS === "web" ? (
                  <Pressable
                    onPress={() => void navigator.clipboard?.writeText(lastInviteUrl)}
                    accessibilityRole="button"
                    className="min-h-10 justify-center self-start"
                  >
                    <Text className="text-[13px] font-semibold text-primary">{t("accounts.copyLink")}</Text>
                  </Pressable>
                ) : null}
              </Box>
            ) : null}
          </SettingsSection>
        ) : null}
      </SettingsSheet>

      {message ? (
        <SettingsNote tone={message.kind === "ok" ? "ok" : "err"} testID="accounts-message">
          {message.text}
        </SettingsNote>
      ) : null}

      <LogoutRow />
    </SettingsPage>
  );
}
