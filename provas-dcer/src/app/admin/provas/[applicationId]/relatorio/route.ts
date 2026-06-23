import { notFound } from "next/navigation";
import { AdminRole } from "@/generated/prisma/client";
import { requireAdminContext } from "@/lib/auth";
import { buildApplicationSummaryPdf, makePdfFilename } from "@/lib/pdf-reports";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApplicationReportRouteContext = {
  params: Promise<{
    applicationId: string;
  }>;
};

export async function GET(_request: Request, { params }: ApplicationReportRouteContext) {
  const context = await requireAdminContext();
  const { applicationId } = await params;
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;

  const application = await prisma.examApplication.findFirst({
    where: {
      id: applicationId,
      ...(isTeacher
        ? {
            participants: {
              some: {
                student: {
                  churchId: scopedChurchId || "__missing_church__",
                },
              },
            },
          }
        : {}),
    },
    include: {
      exam: {
        include: {
          questions: {
            select: {
              points: true,
            },
          },
        },
      },
      attempts: {
        where: {
          ...(isTeacher
            ? {
                student: {
                  churchId: scopedChurchId || "__missing_church__",
                },
              }
            : {}),
        },
      },
      participants: {
        where: {
          ...(isTeacher
            ? {
                student: {
                  churchId: scopedChurchId || "__missing_church__",
                },
              }
            : {}),
        },
        orderBy: [{ student: { church: { name: "asc" } } }, { student: { name: "asc" } }],
        include: {
          student: {
            include: {
              church: true,
            },
          },
        },
      },
    },
  });

  if (!application) {
    notFound();
  }

  const fallbackTotalPoints = application.exam.questions.reduce((sum, question) => sum + question.points, 0);
  const generatedAt = new Date();
  const attemptsByStudentId = new Map(application.attempts.map((attempt) => [attempt.studentId, attempt]));
  const pdf = await buildApplicationSummaryPdf({
    examTitle: application.exam.title,
    applicationTitle: application.title,
    accessCode: application.accessCode,
    passingPercent: application.exam.passingPercent ?? 70,
    rows: application.participants.map((participant) => {
      const attempt = attemptsByStudentId.get(participant.studentId);
      const status = getReportStatus(attempt, generatedAt);
      const hasResult = status === "SUBMITTED" || status === "EXPIRED";

      return {
        studentName: participant.student.name,
        churchName: participant.student.church.name,
        category: participant.student.category,
        status,
        score: hasResult ? attempt?.score ?? 0 : null,
        totalPoints: attempt?.totalPoints || fallbackTotalPoints,
        timeUsedSeconds: attempt?.timeUsedSeconds,
      };
    }),
  });

  const filename = makePdfFilename(`relatorio-${application.exam.title}-${application.title}`);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function getReportStatus(
  attempt:
    | {
        status: string;
        expiresAt: Date;
      }
    | undefined,
  generatedAt: Date,
) {
  if (!attempt) return "NOT_STARTED";
  if (attempt.status === "IN_PROGRESS" && generatedAt > attempt.expiresAt) return "EXPIRED";
  return attempt.status;
}
