import { NextResponse } from "next/server";
import { AdminRole } from "@/generated/prisma/client";
import { getAdminContext } from "@/lib/auth";
import { deleteSystemBackupArchive } from "@/lib/system-backup";

function redirectTo(request: Request, path: string) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const baseUrl = host ? `${protocol}://${host}` : request.url;

  return NextResponse.redirect(new URL(path, baseUrl), { status: 303 });
}

function encodeMessage(message: string) {
  return encodeURIComponent(message.slice(0, 180));
}

async function requireSecurityAccess(request: Request) {
  const context = await getAdminContext();

  if (!context) {
    return redirectTo(request, "/admin/login");
  }

  if (context.role !== AdminRole.ADMIN && context.role !== AdminRole.ADMIN_TEACHER) {
    return redirectTo(request, "/admin?erro=permissao");
  }

  return null;
}

export async function POST(request: Request) {
  const response = await requireSecurityAccess(request);

  if (response) return response;

  try {
    const formData = await request.formData();
    const fileName = String(formData.get("backupFileName") || "").trim();

    await deleteSystemBackupArchive(fileName);

    return redirectTo(request, "/admin/seguranca?ok=backup-excluido");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel excluir o backup.";
    return redirectTo(request, `/admin/seguranca?erro=${encodeMessage(message)}`);
  }
}
