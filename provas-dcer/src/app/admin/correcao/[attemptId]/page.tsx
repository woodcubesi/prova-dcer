import Link from "next/link";
import { notFound } from "next/navigation";
import { updateManualGradesAction } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { getCategoryLabel } from "@/lib/categories";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/text";

export const dynamic = "force-dynamic";

type CorrectionDetailPageProps = {
  params: Promise<{
    attemptId: string;
  }>;
  searchParams?: Promise<{
    ok?: string;
  }>;
};

export default async function CorrectionDetailPage({ params, searchParams }: CorrectionDetailPageProps) {
  await requireAdmin();
  const { attemptId } = await params;
  const query = searchParams ? await searchParams : {};

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

  return (
    <AdminShell title="Conferir prova" description="Revise as respostas e ajuste a pontuacao discursiva.">
      {query.ok ? (
        <div className="mb-4 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Correcao salva.
        </div>
      ) : null}

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
          <div className="grid gap-2 text-sm sm:grid-cols-3">
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
                {score} / {totalPoints}
              </p>
            </div>
          </div>
        </div>
      </section>

      <form action={updateManualGradesAction} className="mt-5 space-y-4">
        <input type="hidden" name="attemptId" value={attempt.id} />

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

              {question.type === "MULTIPLE_CHOICE" ? (
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
              ) : (
                <div className="mt-4 grid gap-3">
                  <label className="block">
                    <span className="text-sm font-medium">Resposta discursiva</span>
                    <textarea
                      readOnly
                      value={answer?.textAnswer || ""}
                      rows={6}
                      className="mt-1 w-full rounded-md border border-[#cdd8cf] bg-[#fbfcfa] px-3 py-3"
                    />
                  </label>
                  {answer ? (
                    <div className="grid gap-3 lg:grid-cols-[180px_1fr]">
                      <label className="block">
                        <span className="text-sm font-medium">Pontos</span>
                        <input
                          name={`points_${answer.id}`}
                          type="number"
                          min={0}
                          max={question.points}
                          step={0.5}
                          defaultValue={answer.pointsAwarded ?? ""}
                          className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium">Comentario interno opcional</span>
                        <input
                          name={`comment_${answer.id}`}
                          defaultValue={answer.manualComment || ""}
                          className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          );
        })}

        <div className="sticky bottom-0 rounded-lg border border-[#dfe6dd] bg-white/95 p-4 shadow-lg backdrop-blur">
          <button className="w-full rounded-md bg-[#12382a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1c513d] sm:w-auto">
            Salvar correcao
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
