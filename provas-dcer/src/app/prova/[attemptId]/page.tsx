import { redirect } from "next/navigation";
import { ExamRunner } from "@/components/exam/ExamRunner";
import { prisma } from "@/lib/prisma";
import { filterQuestionsForCategory } from "@/lib/questions";

export const dynamic = "force-dynamic";

type ExamPageProps = {
  params: Promise<{
    attemptId: string;
  }>;
};

export default async function ExamPage({ params }: ExamPageProps) {
  const { attemptId } = await params;
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
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
    },
  });

  if (!attempt) {
    redirect("/prova");
  }

  if (attempt.status !== "IN_PROGRESS") {
    redirect("/prova/finalizada?status=ja-enviada");
  }

  if (new Date() > attempt.expiresAt) {
    await prisma.attempt.update({
      where: { id: attempt.id },
      data: { status: "EXPIRED" },
    });
    redirect("/prova/finalizada?status=expirada");
  }

  const questions = filterQuestionsForCategory(
    attempt.application.exam.questions,
    attempt.student.category,
  );

  if (questions.length === 0) {
    redirect("/prova?erro=Esta prova nao possui questoes ativas para sua categoria.");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-4 sm:px-6">
      <ExamRunner
        attemptId={attempt.id}
        studentName={attempt.student.name}
        churchName={attempt.student.church.name}
        embassyName={attempt.student.church.embassyName}
        category={attempt.student.category}
        applicationTitle={attempt.application.title}
        examTitle={attempt.application.exam.title}
        expiresAt={attempt.expiresAt.toISOString()}
        questions={questions.map((question, questionIndex) => ({
          id: question.id,
          position: questionIndex + 1,
          statement: question.statement,
          points: question.points,
          options: question.options.map((option) => ({
            id: option.id,
            label: option.label,
            text: option.text,
          })),
        }))}
      />
    </main>
  );
}
