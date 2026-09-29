// lib/email/send.test.ts
import { sendEmail } from "@/lib/email/send";
import { createTransporter } from "@/lib/email/smtp";

jest.mock("@/lib/email/smtp", () => ({
  createTransporter: jest.fn(),
  getFromAddress: () => "test@example.com",
}));

describe("sendEmail", () => {
  it("returns error when SMTP not configured", async () => {
    (createTransporter as jest.Mock).mockReturnValue(null);
    const result = await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>Hi</p>",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("SMTP");
  });

  it("sends mail when transporter exists", async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    (createTransporter as jest.Mock).mockReturnValue({ sendMail });
    const result = await sendEmail({
      to: "a@b.com",
      subject: "Invoice",
      html: "<p>Body</p>",
      text: "Body",
    });
    expect(result.ok).toBe(true);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "a@b.com",
        subject: "Invoice",
      })
    );
  });

  it("passes PDF attachments to nodemailer", async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    (createTransporter as jest.Mock).mockReturnValue({ sendMail });
    const pdf = Buffer.from("%PDF-1.4 test");

    const result = await sendEmail({
      to: "client@example.com",
      subject: "Invoice INV-001",
      html: "<p>See attached PDF</p>",
      attachments: [
        {
          filename: "INV-001.pdf",
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: "INV-001.pdf",
            contentType: "application/pdf",
          }),
        ],
      })
    );
  });

  it("uses the plain verified address as From when no fromName is given (backward compatible)", async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    (createTransporter as jest.Mock).mockReturnValue({ sendMail });

    await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "test@example.com", replyTo: undefined })
    );
  });

  it("sends a {name, address} From object with the verified address unchanged, plus Reply-To, when a sender identity is given", async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    (createTransporter as jest.Mock).mockReturnValue({ sendMail });

    await sendEmail({
      to: "client@example.com",
      subject: "Invoice",
      html: "<p>Body</p>",
      fromName: "Kovács Anna EV via InvoHub",
      replyTo: "anna@kovacs.hu",
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: "Kovács Anna EV via InvoHub", address: "test@example.com" },
        replyTo: "anna@kovacs.hu",
      })
    );
  });

  it("sanitizes fromName/replyTo again before handing them to nodemailer (defense in depth)", async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    (createTransporter as jest.Mock).mockReturnValue({ sendMail });

    await sendEmail({
      to: "client@example.com",
      subject: "Invoice",
      html: "<p>Body</p>",
      fromName: 'Acme "Kft."\r\nBcc: evil@example.com',
      replyTo: "owner@example.com\r\nBcc:evil@example.com",
    });

    const call = sendMail.mock.calls[0][0];
    expect((call.from as { name: string }).name).not.toMatch(/[\r\n"]/);
    expect(call.replyTo).not.toMatch(/[\r\n]/);
  });

  it("preserves Hungarian characters end to end (subject 'Számla', diacritics ő/ű)", async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    (createTransporter as jest.Mock).mockReturnValue({ sendMail });

    await sendEmail({
      to: "ugyfel@example.hu",
      subject: "Számla INV-2026-001 — Nagy Ünőke Kft.",
      html: "<p>Tisztelt Ügyfelünk, köszönjük a beszerzést!</p>",
      fromName: "Nagy Ünőke Kft. via InvoHub",
    });

    const call = sendMail.mock.calls[0][0];
    expect(call.subject).toBe("Számla INV-2026-001 — Nagy Ünőke Kft.");
    expect(call.html).toContain("Tisztelt Ügyfelünk");
    expect((call.from as { name: string }).name).toBe("Nagy Ünőke Kft. via InvoHub");
  });

  it("logs SMTP failures server-side but returns only a generic message for the caller to translate", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const sendMail = jest.fn().mockRejectedValue(new Error("535 Authentication failed for user@smtp.example.com"));
    (createTransporter as jest.Mock).mockReturnValue({ sendMail });

    const result = await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });

    expect(result.ok).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
