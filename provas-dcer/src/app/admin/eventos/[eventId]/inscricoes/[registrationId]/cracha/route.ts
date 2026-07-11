import { notFound } from "next/navigation";
import { AdminRole } from "@/generated/prisma/client";
import { requireAdminContext } from "@/lib/auth";
import { buildEventBadgePdf, makePdfFilename } from "@/lib/pdf-reports";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EventBadgeRouteContext = {
  params: Promise<{
    eventId: string;
    registrationId: string;
  }>;
};

export async function GET(request: Request, { params }: EventBadgeRouteContext) {
  const context = await requireAdminContext();
  const { eventId, registrationId } = await params;
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;

  const registration = await prisma.eventRegistration.findFirst({
    where: {
      id: registrationId,
      eventId,
      ...(isTeacher ? { churchId: scopedChurchId || "__missing_church__" } : {}),
    },
    include: {
      church: true,
      event: true,
    },
  });

  if (!registration) {
    notFound();
  }

  const appUrl = process.env.APP_URL || new URL(request.url).origin;
  const qrTargetUrl = new URL("/prova", appUrl);
  qrTargetUrl.searchParams.set("evento", registration.registrationCode);

  const pdf = await buildEventBadgePdf({
    eventTitle: registration.event.title,
    participantName: registration.name,
    churchName: registration.church.name,
    category: registration.category,
    registrationCode: registration.registrationCode,
    qrTargetUrl: qrTargetUrl.toString(),
  });
  const filename = makePdfFilename(`cracha-${registration.name}-${registration.registrationCode}`);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
