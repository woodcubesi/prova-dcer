import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { getMailConfig, getPublicMailConfig, type MailConfig } from "@/lib/system-mail-config";

type SendAdminPasswordResetEmailParams = {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
};

type SendAdminMfaResetEmailParams = SendAdminPasswordResetEmailParams;

function getEnv(name: string) {
  return process.env[name]?.trim();
}

export function getSmtpTransportOptions(config: MailConfig): SMTPTransport.Options {
  return {
    host: config.host, port: config.port,
    secure: config.security === "TLS",
    requireTLS: config.security === "STARTTLS" || (config.useAuth && config.security === "AUTO"),
    ignoreTLS: config.security === "NONE",
    ...(config.useAuth ? {auth:{user:config.username, pass:config.password}} : {}),
    tls: {rejectUnauthorized:true},
    connectionTimeout:10000, greetingTimeout:10000, socketTimeout:20000, dnsTimeout:10000,
    disableFileAccess:true, disableUrlAccess:true,
  };
}

async function sendConfiguredMail(message: {to:string; subject:string; text:string; html?:string}, test = false) {
  const config = await getMailConfig();
  if (!test && config.source !== "database" && getEnv("MAIL_DRIVER") === "console") {
    console.info("Development email generated:", message);
    return;
  }
  if (!config.enabled || !config.host || !config.fromEmail) throw new Error("SMTP_DISABLED");
  if (config.useAuth && !config.password) throw new Error("SMTP_PASSWORD_REQUIRED");
  try {
    const transporter = nodemailer.createTransport(getSmtpTransportOptions(config));
    const result = await transporter.sendMail({...message, from:{name:config.fromName,address:config.fromEmail}});
    if (!result.accepted?.length) throw new Error("SMTP_RECIPIENT_REJECTED");
  } catch (error) {
    const code = (error as {code?:string}).code;
    throw new Error(code === "EAUTH" ? "SMTP_AUTH_FAILED" : code === "ETIMEDOUT" ? "SMTP_TIMEOUT" : "SMTP_SEND_FAILED");
  }
}

export async function sendSmtpTestEmail(to: string) {
  await sendConfiguredMail({to, subject:"Teste SMTP - Provas DCER Paulista", text:"A configuracao SMTP desta instalacao foi validada pelo envio desta mensagem."}, true);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function getAppUrl() {
  return (await getPublicMailConfig()).appUrl;
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
    to,
    subject,
    text,
    html,
  };

  await sendConfiguredMail(message);
}

export async function sendAdminMfaResetEmail({
  to,
  name,
  resetUrl,
  expiresInMinutes,
}: SendAdminMfaResetEmailParams) {
  const subject = "Redefinicao de MFA - Provas DCER Paulista";
  const text = [
    `Ola, ${name}.`,
    "",
    "Recebemos uma solicitacao para redefinir seu autenticador MFA administrativo.",
    `Use este link nos proximos ${expiresInMinutes} minutos:`,
    resetUrl,
    "",
    "Ao concluir a redefinicao, voce configurara um novo autenticador no proximo login.",
    "Se voce nao solicitou a redefinicao, ignore este e-mail.",
  ].join("\n");
  const html = [
    `<p>Ola, ${escapeHtml(name)}.</p>`,
    "<p>Recebemos uma solicitacao para redefinir seu autenticador MFA administrativo.</p>",
    `<p>Use este link nos proximos ${expiresInMinutes} minutos:</p>`,
    `<p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>`,
    "<p>Ao concluir a redefinicao, voce configurara um novo autenticador no proximo login.</p>",
    "<p>Se voce nao solicitou a redefinicao, ignore este e-mail.</p>",
  ].join("");

  const message = {
    to,
    subject,
    text,
    html,
  };

  await sendConfiguredMail(message);
}
