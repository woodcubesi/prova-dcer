import { notFound } from "next/navigation";
import { AdminRole } from "@/generated/prisma/client";
import { requireAdminContext } from "@/lib/auth";
import { getEventApplicationTypeLabel } from "@/lib/events";
import { buildEventQrControlPdf, makePdfFilename } from "@/lib/pdf-reports";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EventQrControlRouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function GET(request: Request, { params }: EventQrControlRouteContext) {
  const context = await requireAdminContext();
  const { eventId } = await params;
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;
  const appUrl = process.env.APP_URL || new URL(request.url).origin;

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      ...(isTeacher ? { active: true } : {}),
    },
    include: {
      registrations: {
        where: isTeacher ? { churchId: scopedChurchId || "__missing_church__" } : {},
        orderBy: [{ church: { name: "asc" } }, { name: "asc" }],
        include: {
          church: true,
          assignments: {
            orderBy: { createdAt: "asc" },
            include: {
              eventApplication: {
                include: {
                  application: {
                    include: {
                      exam: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  const rows = event.registrations.flatMap((registration) => {
    const qrTargetUrl = new URL("/prova", appUrl);
    qrTargetUrl.searchParams.set("evento", registration.registrationCode);

    return registration.assignments.map((assignment) => ({
      participantName: registration.name,
      registrationCode: registration.registrationCode,
      churchName: registration.church.name,
      category: registration.category,
      program: registration.program,
      applicationTitle: assignment.eventApplication.application.title,
      examTitle: assignment.eventApplication.application.exam.title,
      typeLabel: getEventApplicationTypeLabel(assignment.eventApplication.type),
      qrTargetUrl: qrTargetUrl.toString(),
    }));
  });

  const pdf = await buildEventQrControlPdf({
    eventTitle: event.title,
    generatedAt: new Date(),
    rows,
  });
  const filename = makePdfFilename(`controle-qr-${event.title}`);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
