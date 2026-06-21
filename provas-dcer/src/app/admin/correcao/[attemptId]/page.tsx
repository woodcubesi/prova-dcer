import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminRole } from "@/generated/prisma/client";
import { getCategoryLabel } from "@/lib/categories";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/text";

export const dynamic = "force-dynamic";

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

type CorrectionDetailPageProps = {
  params: Promise<{
    attemptId: string;
  }>;
};

export default async function CorrectionDetailPage({ params }: CorrectionDetailPageProps) {
  const context = await requireAdminContext();
  const { attemptId } = await params;
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
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

  const answerByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
  const totalPoints = attempt.application.exam.questions.reduce((sum, question) => sum + question.points, 0);
  const score = attempt.answers.reduce((sum, answer) => sum + (answer.pointsAwarded || 0), 0);
  const passingPercent = attempt.application.exam.passingPercent ?? 70;
  const scorePercent = totalPoints ? (score / totalPoints) * 100 : 0;
  const passed = scorePercent >= passingPercent;

  return (
    <AdminShell title="Conferir prova" description="Revise as respostas de multipla escolha e a pontuacao automatica.">
      <section className="rounded-lg border border-[#dfe6dd] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/admin/correcao" className="text-sm font-semibold text-[#2c6d49]">
              Voltar para lista
            </Link>
            <h2 className="mt-2 text-2xl font-semibold">{attempt.application.exam.title}</h2>
            <p className="mt-1 text-sm text-[#66736a]">
              {attempt.student.name} - {attempt.student.church.name} - {getCategoryLabel(attempt.student.category)}
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-md bg-[#effaf2] px-3 py-2">
              <p className="text-xs text-[#66736a]">Tempo usado</p>
              <p className="font-semibold">{attempt.timeUsedSeconds ? formatDuration(attempt.timeUsedSeconds) : "-"}</p>
            </div>
            <div className="rounded-md bg-[#effaf2] px-3 py-2">
              <p className="text-xs text-[#66736a]">Status</p>
              <p className="font-semibold">{attempt.status === "SUBMITTED" ? "Enviada" : "Expirada"}</p>
            </div>
            <div className="rounded-md bg-[#effaf2] px-3 py-2">
              <p className="text-xs text-[#66736a]">Pontuacao</p>
              <p className="font-semibold">
                {formatScore(score)} / {formatScore(totalPoints)}
              </p>
            </div>
            <div className="rounded-md bg-[#effaf2] px-3 py-2">
              <p className="text-xs text-[#66736a]">Aproveitamento</p>
              <p className="font-semibold">{formatPercent(scorePercent)}</p>
            </div>
            <div className="rounded-md bg-[#effaf2] px-3 py-2">
              <p className="text-xs text-[#66736a]">Resultado</p>
              <p className={`font-semibold ${passed ? "text-[#1f623e]" : "text-[#8d3b2d]"}`}>
                {passed ? "Aprovado" : "Reprovado"}
              </p>
              <p className="text-xs text-[#66736a]">Minimo {formatPercent(passingPercent)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 space-y-4">
        {attempt.application.exam.questions.map((question) => {
          const answer = answerByQuestion.get(question.id);
          const correctOption = question.options.find((option) => option.isCorrect);

          return (
            <section key={question.id} className="rounded-lg border border-[#dfe6dd] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2c6d49]">
                    Questao {question.position}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{question.statement}</h3>
                </div>
                <span className="rounded-full bg-[#effaf2] px-2 py-1 text-xs font-semibold text-[#1f623e]">
                  {question.points} pt
                </span>
              </div>

              <div className="mt-4 grid gap-2">
                <div className="rounded-md border border-[#edf1eb] bg-[#fbfcfa] px-3 py-2 text-sm">
                  Resposta do aluno:{" "}
                  <strong>
                    {answer?.selectedOption
                      ? `${answer.selectedOption.label}) ${answer.selectedOption.text}`
                      : "Sem resposta"}
                  </strong>
                </div>
                <div className="rounded-md border border-[#edf1eb] bg-[#fbfcfa] px-3 py-2 text-sm">
                  Gabarito: <strong>{correctOption ? `${correctOption.label}) ${correctOption.text}` : "-"}</strong>
                </div>
                <div className="rounded-md border border-[#edf1eb] bg-[#fbfcfa] px-3 py-2 text-sm">
                  Pontos: <strong>{answer?.pointsAwarded ?? 0}</strong>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}
