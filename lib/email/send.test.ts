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
});
