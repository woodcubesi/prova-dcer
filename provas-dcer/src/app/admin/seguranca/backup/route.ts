import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { AdminRole } from "@/generated/prisma/client";
import { getAdminContext } from "@/lib/auth";
import { createSystemBackupArchive, resolveSystemBackupArchive } from "@/lib/system-backup";

function redirectTo(request: Request, path: string) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const baseUrl = host ? `${protocol}://${host}` : request.url;

  return NextResponse.redirect(new URL(path, baseUrl));
}

function encodeMessage(message: string) {
  return encodeURIComponent(message.slice(0, 180));
}

async function requireSecurityAccess(request: Request) {
  const context = await getAdminContext();

  if (!context) {
    return { context: null, response: redirectTo(request, "/admin/login") };
  }

  if (context.role !== AdminRole.ADMIN && context.role !== AdminRole.ADMIN_TEACHER) {
    return { context: null, response: redirectTo(request, "/admin?erro=permissao") };
  }

  return { context, response: null };
}

export async function GET(request: Request) {
  const { context, response } = await requireSecurityAccess(request);

  if (response) return response;

  try {
    const url = new URL(request.url);
    const requestedFileName = url.searchParams.get("arquivo");
    const archivePath = requestedFileName
      ? await resolveSystemBackupArchive(requestedFileName)
      : (await createSystemBackupArchive(context?.user?.email || context?.user?.name || null)).path;
    const fileName = archivePath.split(/[\\/]/).pop() || "provas-dcer-backup.tar.gz";
    const file = await fs.readFile(archivePath);

    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel gerar o backup.";
    return redirectTo(request, `/admin/seguranca?erro=${encodeMessage(message)}`);
  }
}
