import { NextResponse } from "next/server";
import { AdminRole } from "@/generated/prisma/client";
import { getAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  resolveSystemBackupArchive,
  restoreSystemBackupArchive,
  saveUploadedSystemBackup,
} from "@/lib/system-backup";

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
    return { response: redirectTo(request, "/admin/login") };
  }

  if (context.role !== AdminRole.ADMIN && context.role !== AdminRole.ADMIN_TEACHER) {
    return { response: redirectTo(request, "/admin?erro=permissao") };
  }

  return { response: null };
}

function getUploadedFile(value: FormDataEntryValue | null) {
  if (!value || typeof value === "string" || typeof value.arrayBuffer !== "function") {
    throw new Error("Selecione um arquivo de backup valido.");
  }

  return value as File;
}

export async function POST(request: Request) {
  const { response } = await requireSecurityAccess(request);

  if (response) return response;

  try {
    const formData = await request.formData();
    const confirmation = String(formData.get("confirmation") || "").trim().toUpperCase();
    const restoreDatabase = formData.get("restoreDatabase") === "on";
    const restoreApplication = formData.get("restoreApplication") === "on";

    if (confirmation !== "RESTAURAR") {
      throw new Error("Digite RESTAURAR para confirmar.");
    }

    const source = String(formData.get("source") || "server");
    const archivePath =
      source === "upload"
        ? await saveUploadedSystemBackup(getUploadedFile(formData.get("backupFile")))
        : await resolveSystemBackupArchive(String(formData.get("backupFileName") || ""));

    if (restoreDatabase) {
      await prisma.$disconnect();
    }

    const result = await restoreSystemBackupArchive(archivePath, {
      restoreDatabase,
      restoreApplication,
    });

    const params = new URLSearchParams({
      ok: "restaurado",
      banco: result.restoredDatabase ? "1" : "0",
      aplicacao: result.applicationRestorePath ? "1" : "0",
    });

    return redirectTo(request, `/admin/seguranca?${params.toString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel restaurar o backup.";
    return redirectTo(request, `/admin/seguranca?erro=${encodeMessage(message)}`);
  }
}
