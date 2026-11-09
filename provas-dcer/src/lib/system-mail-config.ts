import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const mailSecurityModes = ["STARTTLS", "TLS", "AUTO", "NONE"] as const;
export type MailSecurity = (typeof mailSecurityModes)[number];
export type MailConfig = {
  enabled: boolean;
  host: string;
  port: number;
  security: MailSecurity;
  useAuth: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  appUrl: string;
  source: "database" | "environment" | "unconfigured";
};
export type PublicMailConfig = Omit<MailConfig, "password"> & { hasPassword: boolean };

const boolEnv = (name: string) => /^(1|true|yes|sim)$/i.test(process.env[name] || "");
function encryptionKey() {
  const secret = process.env.SYSTEM_SETTINGS_ENCRYPTION_KEY || process.env.ADMIN_MFA_ENCRYPTION_KEY || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret === "dev-secret") throw new Error("SETTINGS_KEY_MISSING");
  return createHash("sha256").update("system-smtp:v1:").update(secret).digest();
}
export function encryptSmtpPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const value = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), value.toString("base64url")].join(":");
}
export function decryptSmtpPassword(value: string) {
  const [version, iv, tag, encrypted] = value.split(":");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("SETTINGS_SECRET_INVALID");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
function environmentConfig(): MailConfig {
  const host = process.env.SMTP_HOST?.trim() || "";
  const from = process.env.MAIL_FROM || process.env.SMTP_FROM || "";
  const match = from.match(/^(.*?)<([^<>]+)>$/);
  const username = process.env.SMTP_USER?.trim() || "";
  return {
    enabled: Boolean(host) && process.env.MAIL_DRIVER !== "disabled" && process.env.MAIL_DRIVER !== "console",
    host, port: Number(process.env.SMTP_PORT || 25),
    security: boolEnv("SMTP_SECURE") ? "TLS" : boolEnv("SMTP_IGNORE_TLS") ? "NONE" : boolEnv("SMTP_REQUIRE_TLS") ? "STARTTLS" : "AUTO",
    useAuth: Boolean(username), username,
    password: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "",
    fromName: match ? match[1].trim().replace(/^"|"$/g, "") : "Provas DCER Paulista",
    fromEmail: match ? match[2].trim() : from.trim(),
    appUrl: (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, ""),
    source: host ? "environment" : "unconfigured",
  };
}
export async function getMailConfig(): Promise<MailConfig> {
  const row = await prisma.systemMailSettings.findUnique({ where: { id: 1 } });
  if (!row) return environmentConfig();
  return {
    enabled: row.enabled, host: row.host, port: row.port, security: row.security as MailSecurity,
    useAuth: row.useAuth, username: row.username,
    password: row.enabled && row.useAuth && row.passwordEncrypted ? decryptSmtpPassword(row.passwordEncrypted) : "",
    fromName: row.fromName, fromEmail: row.fromEmail, appUrl: row.appUrl, source: "database",
  };
}
export async function getPublicMailConfig(): Promise<PublicMailConfig> {
  const row = await prisma.systemMailSettings.findUnique({ where: { id: 1 } });
  const config = row ? {
    enabled: row.enabled, host: row.host, port: row.port, security: row.security as MailSecurity,
    useAuth: row.useAuth, username: row.username, fromName: row.fromName,
    fromEmail: row.fromEmail, appUrl: row.appUrl, source: "database" as const,
    hasPassword: Boolean(row.passwordEncrypted),
  } : (() => {
    const { password, ...config } = environmentConfig();
    return { ...config, hasPassword: Boolean(password) };
  })();
  return config;
}
export const mailSettingsSchema = z.object({
  enabled: z.boolean(),
  host: z.string().trim().max(253).refine(value => !value || /^[a-zA-Z0-9._:[\]-]+$/.test(value), "Informe somente o nome ou IP do servidor SMTP."),
  port: z.coerce.number().int().min(1, "Porta invalida.").max(65535, "Porta invalida."),
  security: z.enum(mailSecurityModes),
  useAuth: z.boolean(), username: z.string().trim().max(320),
  password: z.string().max(1024),
  fromName: z.string().trim().min(1, "Informe o nome do remetente.").max(150).refine(value => !/[\r\n]/.test(value), "Nome de remetente invalido."),
  fromEmail: z.string().trim().refine(value => !value || z.email().safeParse(value).success, "E-mail do remetente invalido."),
  appUrl: z.string().trim().url("Endereco publico invalido.").refine(value => {
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash; }
    catch { return false; }
  }, "Use um endereco HTTP ou HTTPS sem caminho, usuario ou senha."),
}).superRefine((value, context) => {
  if (value.enabled && !value.host) context.addIssue({code:"custom", path:["host"], message:"Informe o servidor SMTP."});
  if (value.enabled && !value.fromEmail) context.addIssue({code:"custom", path:["fromEmail"], message:"Informe o e-mail do remetente."});
  if (value.enabled && value.useAuth && !value.username) context.addIssue({code:"custom", path:["username"], message:"Informe o usuario SMTP."});
  if (value.enabled && value.useAuth && value.security === "NONE") context.addIssue({code:"custom", path:["security"], message:"Use TLS ou STARTTLS para enviar credenciais SMTP."});
});
export async function saveMailConfig(input: z.infer<typeof mailSettingsSchema>) {
  const previous = await getPublicMailConfig();
  const stored = await prisma.systemMailSettings.findUnique({where:{id:1}});
  let encrypted = stored?.passwordEncrypted || null;
  if (!input.useAuth) encrypted = null;
  else if (input.password) encrypted = encryptSmtpPassword(input.password);
  else if (input.host !== previous.host || input.username !== previous.username) throw new Error("SMTP_NEW_PASSWORD_REQUIRED");
  else if (!stored && previous.hasPassword) encrypted = encryptSmtpPassword(environmentConfig().password);
  if (input.enabled && input.useAuth && !encrypted) throw new Error("SMTP_PASSWORD_REQUIRED");
  const {password: _password, ...fields} = input;
  void _password;
  const data = {...fields, username:input.useAuth ? input.username : "", passwordEncrypted:encrypted, appUrl:new URL(input.appUrl).origin};
  await prisma.systemMailSettings.upsert({where:{id:1}, create:{id:1,...data}, update:data});
}
