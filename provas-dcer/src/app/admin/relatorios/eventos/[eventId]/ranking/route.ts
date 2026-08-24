import { notFound } from "next/navigation";
import { AdminRole, AttemptStatus, Category } from "@/generated/prisma/client";
import { requireAdminContext } from "@/lib/auth";
import { buildEventRankingPdf, makePdfFilename } from "@/lib/pdf-reports";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EventRankingRouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function GET(request: Request, { params }: EventRankingRouteContext) {
  const context = await requireAdminContext();
  const { eventId } = await params;
  const url = new URL(request.url);
  const applicationId = url.searchParams.get("prova") || "";
  const requestedCategory = url.searchParams.get("categoria") || "";
  const category = Object.values(Category).includes(requestedCategory as Category)
    ? (requestedCategory as Category)
    : null;
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;
  const scopedChurchFilter = scopedChurchId || "__missing_church__";

  const [event, attempts] = await Promise.all([
    prisma.event.findFirst({
      where: {
        id: eventId,
        ...(isTeacher
          ? {
              registrations: {
                some: {
                  churchId: scopedChurchFilter,
                },
              },
            }
          : {}),
      },
      include: {
        applications: {
          include: {
            application: true,
          },
        },
      },
    }),
    prisma.attempt.findMany({
      where: {
        eventRegistration: {
          eventId,
          ...(isTeacher ? { churchId: scopedChurchFilter } : {}),
          ...(category ? { category } : {}),
        },
        status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED] },
        ...(applicationId ? { applicationId } : {}),
      },
      orderBy: [{ submittedAt: "asc" }, { startedAt: "asc" }],
      include: {
        application: {
          include: {
            exam: true,
          },
        },
        eventRegistration: {
          include: {
            church: true,
          },
        },
      },
    }),
  ]);

  if (!event) {
    notFound();
  }

  const selectedApplication = applicationId
    ? event.applications.find((eventApplication) => eventApplication.applicationId === applicationId)?.application || null
    : null;

  if (applicationId && !selectedApplication) {
    notFound();
  }

  const pdf = await buildEventRankingPdf({
    eventTitle: event.title,
    applicationTitle: selectedApplication ? selectedApplication.title : null,
    category,
    churchName: isTeacher ? attempts[0]?.eventRegistration?.church.name || null : null,
    generatedAt: new Date(),
    rows: attempts
      .filter((attempt) => attempt.eventRegistration)
      .map((attempt) => ({
        participantName: attempt.eventRegistration?.name || "-",
        registrationCode: attempt.eventRegistration?.registrationCode || "-",
        churchName: attempt.eventRegistration?.church.name || "-",
        category: attempt.eventRegistration?.category || "JUNIOR",
        applicationTitle: attempt.application.title,
        examTitle: attempt.application.exam.title,
        status: attempt.status,
        score: attempt.score,
        totalPoints: attempt.totalPoints,
        timeUsedSeconds: attempt.timeUsedSeconds,
      })),
  });
  const filename = makePdfFilename(
    [
      "ranking",
      event.title,
      selectedApplication?.title || "",
      category || "",
    ]
      .filter(Boolean)
      .join("-"),
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
