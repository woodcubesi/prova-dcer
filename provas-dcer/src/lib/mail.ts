import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

type MailDriver = "console" | "smtp";

type SendAdminPasswordResetEmailParams = {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
};

function getEnv(name: string) {
  return process.env[name]?.trim();
}

function parseBoolean(value?: string) {
  if (!value) return undefined;

  return ["1", "true", "yes", "sim"].includes(value.trim().toLowerCase());
}

function getMailDriver(): MailDriver {
  const driver = getEnv("MAIL_DRIVER")?.toLowerCase();

  if (driver === "smtp" || driver === "console") {
    return driver;
  }

  return getEnv("SMTP_HOST") ? "smtp" : "console";
}

function getSmtpTransportOptions() {
  const host = getEnv("SMTP_HOST");

  if (!host) {
    throw new Error("SMTP_HOST must be configured when MAIL_DRIVER=smtp.");
  }

  const port = Number(getEnv("SMTP_PORT") || "25");
  const user = getEnv("SMTP_USER");
  const password = getEnv("SMTP_PASSWORD");
  const requireTLS = parseBoolean(getEnv("SMTP_REQUIRE_TLS"));
  const ignoreTLS = parseBoolean(getEnv("SMTP_IGNORE_TLS"));
  const rejectUnauthorized = parseBoolean(getEnv("SMTP_TLS_REJECT_UNAUTHORIZED"));

  const options: SMTPTransport.Options = {
    host,
    port,
    secure: parseBoolean(getEnv("SMTP_SECURE")) || false,
  };

  if (user && password) {
    options.auth = {
      user,
      pass: password,
    };
  }

  if (requireTLS !== undefined) {
    options.requireTLS = requireTLS;
  }

  if (ignoreTLS !== undefined) {
    options.ignoreTLS = ignoreTLS;
  }

  if (rejectUnauthorized !== undefined) {
    options.tls = {
      rejectUnauthorized,
    };
  }

  return options;
}

function getMailFrom() {
  return getEnv("MAIL_FROM") || getEnv("SMTP_FROM") || "Provas DCER Paulista <no-reply@localhost>";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function getAppUrl() {
  return (getEnv("APP_URL") || getEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000").replace(/\/+$/, "");
}

export async function sendAdminPasswordResetEmail({
  to,
  name,
  resetUrl,
  expiresInMinutes,
}: SendAdminPasswordResetEmailParams) {
  const subject = "Redefinicao de senha - Provas DCER Paulista";
  const text = [
    `Ola, ${name}.`,
    "",
    "Recebemos uma solicitacao para redefinir sua senha administrativa.",
    `Use este link nos proximos ${expiresInMinutes} minutos:`,
    resetUrl,
    "",
    "Se voce nao solicitou a redefinicao, ignore este e-mail.",
  ].join("\n");
  const html = [
    `<p>Ola, ${escapeHtml(name)}.</p>`,
    "<p>Recebemos uma solicitacao para redefinir sua senha administrativa.</p>",
    `<p>Use este link nos proximos ${expiresInMinutes} minutos:</p>`,
    `<p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>`,
    "<p>Se voce nao solicitou a redefinicao, ignore este e-mail.</p>",
  ].join("");

  const message = {
    from: getMailFrom(),
    to,
    subject,
    text,
    html,
  };

  if (getMailDriver() === "console") {
    console.info("Password reset email generated:", message);
    return;
  }

  const transporter = nodemailer.createTransport(getSmtpTransportOptions());
  await transporter.sendMail(message);
}
