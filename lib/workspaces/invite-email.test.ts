import { buildInviteEmail } from "@/lib/workspaces/invite-email";

describe("buildInviteEmail", () => {
  const base = { url: "https://app.invohub.hu/invite?token=abc", accountName: "Kovács Anna e.v.", inviterName: "Kovács Anna", role: "accountant" as const, expiresInDays: 14 };

  it("names the account, the inviter and the role, with the link in both bodies", () => {
    const m = buildInviteEmail(base);
    expect(m.subject).toBe("InvoHub – meghívó: Kovács Anna e.v.");
    for (const body of [m.text, m.html]) {
      expect(body).toContain("Kovács Anna e.v.");
      expect(body).toContain("könyvelő");
      expect(body).toContain("https://app.invohub.hu/invite?token=abc");
      expect(body).toContain("14 napig");
    }
  });

  it("escapes HTML in names and the link", () => {
    const m = buildInviteEmail({ ...base, accountName: "<b>Evil</b> & Co", inviterName: '"><script>x</script>', url: "https://x.hu/?a=1&b=2" });
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<b>Evil</b>");
    expect(m.html).toContain("&lt;b&gt;Evil&lt;/b&gt; &amp; Co");
    expect(m.html).toContain("a=1&amp;b=2");
  });

  it("falls back to neutral wording without an inviter name or account name", () => {
    const m = buildInviteEmail({ ...base, inviterName: "  ", accountName: " " });
    expect(m.text).toContain("Egy InvoHub-felhasználó meghívott");
    expect(m.subject).toContain("számlázófiók");
  });
});
