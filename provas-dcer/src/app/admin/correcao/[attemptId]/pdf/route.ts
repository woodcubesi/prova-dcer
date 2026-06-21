import { notFound } from "next/navigation";
import { AdminRole } from "@/generated/prisma/client";
import { requireAdminContext } from "@/lib/auth";
import { buildStudentCorrectionPdf, makePdfFilename } from "@/lib/pdf-reports";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CorrectionPdfRouteContext = {
  params: Promise<{
    attemptId: string;
  }>;
};

export async function GET(_request: Request, { params }: CorrectionPdfRouteContext) {
  const context = await requireAdminContext();
  const { attemptId } = await params;
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      status: { in: ["SUBMITTED", "EXPIRED"] },
      ...(isTeacher
        ? {
            student: {
              churchId: scopedChurchId || "__missing_church__",
            },
          }
        : {}),
    },
    include: {
      student: {
        include: {
          church: true,
        },
      },
      application: {
        include: {
          exam: {
            include: {
              questions: {
                orderBy: { position: "asc" },
                include: {
                  options: {
                    orderBy: { position: "asc" },
                  },
                },
              },
            },
          },
        },
      },
      answers: {
        include: {
          selectedOption: true,
        },
      },
    },
  });

  if (!attempt) {
    notFound();
  }

  const totalPoints =
    attempt.totalPoints ??
    attempt.application.exam.questions.reduce((sum, question) => sum + question.points, 0);
  const score =
    attempt.score ?? attempt.answers.reduce((sum, answer) => sum + (answer.pointsAwarded || 0), 0);

  const pdf = await buildStudentCorrectionPdf({
    studentName: attempt.student.name,
    churchName: attempt.student.church.name,
    category: attempt.student.category,
    examTitle: attempt.application.exam.title,
    applicationTitle: attempt.application.title,
    submittedAt: attempt.submittedAt,
    status: attempt.status,
    timeUsedSeconds: attempt.timeUsedSeconds,
    score,
    totalPoints,
    passingPercent: attempt.application.exam.passingPercent ?? 70,
    questions: attempt.application.exam.questions.map((question) => ({
      id: question.id,
      position: question.position,
      statement: question.statement,
      points: question.points,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        text: option.text,
        isCorrect: option.isCorrect,
      })),
    })),
    answers: attempt.answers.map((answer) => ({
      questionId: answer.questionId,
      selectedOption: answer.selectedOption
        ? {
            label: answer.selectedOption.label,
            text: answer.selectedOption.text,
          }
        : null,
      pointsAwarded: answer.pointsAwarded,
      isCorrect: answer.isCorrect,
    })),
  });

  const filename = makePdfFilename(`correcao-${attempt.student.name}-${attempt.application.exam.title}`);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
