"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AdminRole } from "@/generated/prisma/client";
import { requireAdminRole } from "@/lib/auth";
import { mailSettingsSchema, saveMailConfig } from "@/lib/system-mail-config";
import { sendSmtpTestEmail } from "@/lib/mail";

export type SystemMailFormState = { error?: string; success?: string; saved?: number };
function mailError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string,string> = {
    SMTP_DISABLED:"O envio SMTP esta desativado. Salve uma configuracao ativa primeiro.",
    SMTP_PASSWORD_REQUIRED:"Informe a senha SMTP.",
    SMTP_NEW_PASSWORD_REQUIRED:"Informe novamente a senha ao alterar o servidor ou usuario SMTP.",
    SETTINGS_KEY_MISSING:"A chave de protecao desta instalacao nao esta configurada.",
    SMTP_AUTH_FAILED:"O servidor SMTP recusou a autenticacao. Confira o usuario e a senha.",
    SMTP_TIMEOUT:"O servidor SMTP nao respondeu a tempo. Confira servidor, porta e firewall.",
    SMTP_SEND_FAILED:"O envio falhou. Confira servidor, porta, TLS, remetente e permissoes do relay.",
  };
  return messages[code] || "Nao foi possivel concluir a operacao. Confira a configuracao desta instalacao.";
}
export async function saveSystemMailAction(_previous: SystemMailFormState, data: FormData): Promise<SystemMailFormState> {
  await requireAdminRole([AdminRole.ADMIN, AdminRole.ADMIN_TEACHER]);
  const result = mailSettingsSchema.safeParse({
    enabled:data.get("enabled") === "on", host:String(data.get("host") || ""), port:data.get("port"),
    security:data.get("security"), useAuth:data.get("useAuth") === "on",
    username:String(data.get("username") || ""), password:String(data.get("password") || ""),
    fromName:String(data.get("fromName") || ""), fromEmail:String(data.get("fromEmail") || ""), appUrl:String(data.get("appUrl") || ""),
  });
  if (!result.success) return {error:result.error.issues[0]?.message || "Confira os campos."};
  try { await saveMailConfig(result.data); }
  catch (error) { return {error:mailError(error)}; }
  revalidatePath("/admin/sistema");
  return {success:"Configuracao salva.", saved:Date.now()};
}
export async function testSystemMailAction(_previous: SystemMailFormState, data: FormData): Promise<SystemMailFormState> {
  await requireAdminRole([AdminRole.ADMIN, AdminRole.ADMIN_TEACHER]);
  const email = z.email().safeParse(String(data.get("recipient") || "").trim());
  if (!email.success) return {error:"Informe um e-mail de destino valido."};
  try { await sendSmtpTestEmail(email.data); }
  catch (error) { return {error:mailError(error)}; }
  return {success:"Mensagem de teste aceita pelo servidor SMTP. Confira a caixa de entrada."};
}
