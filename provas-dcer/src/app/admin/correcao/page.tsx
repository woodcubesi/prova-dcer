import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminRole, AttemptStatus } from "@/generated/prisma/client";
import { getCategoryLabel } from "@/lib/categories";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/text";

export const dynamic = "force-dynamic";

type CorrectionPageProps = {
  searchParams?: Promise<{
    igreja?: string;
    prova?: string;
  }>;
};

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function getAttemptResult(score?: number | null, totalPoints?: number | null, passingPercent = 70) {
  if (score === null || score === undefined || !totalPoints) {
    return {
      label: "Pendente",
      percent: null,
      passed: false,
    };
  }

  const percent = (score / totalPoints) * 100;

  return {
    label: percent >= passingPercent ? "Aprovado" : "Reprovado",
    percent,
    passed: percent >= passingPercent,
  };
}

export default async function CorrectionPage({ searchParams }: CorrectionPageProps) {
  const context = await requireAdminContext();
  const params = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;
  const selectedChurchId = isTeacher ? scopedChurchId || "" : params.igreja || "";
  const churchFilterId = selectedChurchId || undefined;
  const selectedApplicationId = String(params.prova || "").trim();
  const finalStatuses = [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED];
  const applicationChurchFilter = churchFilterId
    ? {
        attempts: {
          some: {
            status: { in: finalStatuses },
            student: {
              churchId: churchFilterId,
            },
          },
        },
      }
    : {
        attempts: {
          some: {
            status: { in: finalStatuses },
          },
        },
      };

  const [churches, applications, attempts] = await Promise.all([
    prisma.church.findMany({
      where: {
        active: true,
        ...(isTeacher ? { id: scopedChurchId || "__missing_church__" } : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.examApplication.findMany({
      where: applicationChurchFilter,
      orderBy: [{ exam: { title: "asc" } }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        exam: {
          select: {
            title: true,
          },
        },
      },
    }),
    prisma.attempt.findMany({
      where: {
        status: { in: finalStatuses },
        ...(selectedApplicationId ? { applicationId: selectedApplicationId } : {}),
        ...(churchFilterId
          ? {
              student: {
                churchId: churchFilterId,
              },
            }
          : {}),
      },
      orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
      include: {
        student: {
          include: {
            church: true,
          },
        },
        application: {
          include: {
            exam: true,
          },
        },
        answers: true,
      },
    }),
  ]);
  const selectedApplication = applications.find((application) => application.id === selectedApplicationId) || null;

  return (
    <AdminShell title="Correcao" description="Confira respostas enviadas e a pontuacao automatica.">
      {isTeacher && !scopedChurchId ? (
        <div className="mb-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-4 py-3 text-sm text-[#b00018]">
          Seu usuario de conselheiro ainda nao esta vinculado a uma igreja.
        </div>
      ) : null}

      <section className="rounded-lg border border-[#d8def0] bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Provas recebidas</h2>
            <p className="text-sm text-[#5d6480]">O embaixador nao visualiza nota ao final.</p>
          </div>
          <span className="rounded-full bg-[#effaf2] px-3 py-1 text-sm font-semibold text-[#1f623e]">
            {attempts.length} envio(s)
          </span>
        </div>

        <form
          action="/admin/correcao"
          className="mt-4 grid gap-3 rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
        >
          <label className="block">
            <span className="text-sm font-medium">Filtrar por igreja</span>
            {isTeacher ? (
              <>
                <input type="hidden" name="igreja" value={scopedChurchId || ""} />
                <div className="mt-1 rounded-md border border-[#c5cce4] bg-white px-3 py-3 text-sm">
                  {churches[0]?.name || "Igreja nao vinculada"}
                </div>
              </>
            ) : (
              <select
                name="igreja"
                defaultValue={selectedChurchId}
                className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              >
                <option value="">Todas as igrejas</option>
                {churches.map((church) => (
                  <option key={church.id} value={church.id}>
                    {church.name}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label className="block">
            <span className="text-sm font-medium">Filtrar por prova</span>
            <select
              name="prova"
              defaultValue={selectedApplicationId}
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
            >
              <option value="">Todas as provas</option>
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.exam.title} - {application.title}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-md bg-[#000060] px-4 py-3 text-sm font-semibold text-white hover:bg-[#000044]">
            Filtrar
          </button>
        </form>
        {selectedApplication ? (
          <div className="mt-3 flex flex-col gap-2 rounded-md border border-[#e8ecf8] bg-white px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>
              Relatorio da prova selecionada:{" "}
              <strong>
                {selectedApplication.exam.title} - {selectedApplication.title}
              </strong>
            </span>
            <Link
              href={`/admin/provas/${selectedApplication.id}/relatorio`}
              className="rounded-md bg-[#000060] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#000044]"
            >
              Baixar relatorio
            </Link>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:hidden">
          {attempts.map((attempt) => {
            const passingPercent = attempt.application.exam.passingPercent ?? 70;
            const result = getAttemptResult(attempt.score, attempt.totalPoints, passingPercent);

            return (
              <div key={attempt.id} className="rounded-md border border-[#e8ecf8] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{attempt.student.name}</p>
                    <p className="mt-1 text-sm text-[#5d6480]">
                      {attempt.student.church.name} - {getCategoryLabel(attempt.student.category)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#effaf2] px-2 py-1 text-xs font-medium text-[#1f623e]">
                    {attempt.status === "SUBMITTED" ? "Enviada" : "Expirada"}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium">{attempt.application.exam.title}</p>
                <p className="text-xs text-[#5d6480]">{attempt.application.title}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-[#f8faff] px-3 py-2">
                    <p className="text-xs text-[#5d6480]">Tempo usado</p>
                    <p className="font-semibold">
                      {attempt.timeUsedSeconds ? formatDuration(attempt.timeUsedSeconds) : "-"}
                    </p>
                  </div>
                  <div className="rounded-md bg-[#f8faff] px-3 py-2">
                    <p className="text-xs text-[#5d6480]">Pontuacao</p>
                    <p className="font-semibold">
                      {attempt.score === null || attempt.score === undefined
                        ? "Pendente"
                        : `${formatScore(attempt.score)} / ${formatScore(attempt.totalPoints ?? 0)}`}
                    </p>
                  </div>
                  <div className="rounded-md bg-[#f8faff] px-3 py-2">
                    <p className="text-xs text-[#5d6480]">Aprovacao minima</p>
                    <p className="font-semibold">{formatPercent(passingPercent)}</p>
                  </div>
                  <div className="rounded-md bg-[#f8faff] px-3 py-2">
                    <p className="text-xs text-[#5d6480]">Resultado</p>
                    <p className={`font-semibold ${result.passed ? "text-[#1f623e]" : "text-[#b00018]"}`}>
                      {result.label}
                      {result.percent !== null ? ` (${formatPercent(result.percent)})` : ""}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/admin/correcao/${attempt.id}`}
                  className="mt-3 block rounded-md border border-[#000060] px-3 py-2 text-center text-sm font-semibold text-[#000060]"
                >
                  Abrir
                </Link>
                <Link
                  href={`/admin/correcao/${attempt.id}/pdf`}
                  className="mt-2 block rounded-md bg-[#000060] px-3 py-2 text-center text-sm font-semibold text-white"
                >
                  Baixar PDF
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[#d8def0] text-xs uppercase tracking-wide text-[#5d6480]">
              <tr>
                <th className="py-3 pr-4">Embaixador</th>
                <th className="py-3 pr-4">Prova</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Tempo usado</th>
                <th className="py-3 pr-4">Pontuacao</th>
                <th className="py-3 pr-4">Resultado</th>
                <th className="py-3 pr-4">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => {
                const passingPercent = attempt.application.exam.passingPercent ?? 70;
                const result = getAttemptResult(attempt.score, attempt.totalPoints, passingPercent);

                return (
                  <tr key={attempt.id} className="border-b border-[#e8ecf8] last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{attempt.student.name}</p>
                      <p className="text-xs text-[#5d6480]">
                        {attempt.student.church.name} - {getCategoryLabel(attempt.student.category)}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <p>{attempt.application.exam.title}</p>
                      <p className="text-xs text-[#5d6480]">{attempt.application.title}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-[#effaf2] px-2 py-1 text-xs font-medium text-[#1f623e]">
                        {attempt.status === "SUBMITTED" ? "Enviada" : "Expirada"}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {attempt.timeUsedSeconds ? formatDuration(attempt.timeUsedSeconds) : "-"}
                    </td>
                    <td className="py-3 pr-4">
                      {attempt.score === null || attempt.score === undefined
                        ? "Pendente"
                        : `${formatScore(attempt.score)} / ${formatScore(attempt.totalPoints ?? 0)}`}
                    </td>
                    <td className="py-3 pr-4">
                      <p className={result.passed ? "font-semibold text-[#1f623e]" : "font-semibold text-[#b00018]"}>
                        {result.label}
                      </p>
                      <p className="text-xs text-[#5d6480]">
                        {result.percent !== null
                          ? `${formatPercent(result.percent)} de ${formatPercent(passingPercent)}`
                          : `Minimo ${formatPercent(passingPercent)}`}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/correcao/${attempt.id}`}
                          className="rounded-md border border-[#000060] px-3 py-2 text-sm font-semibold text-[#000060] hover:bg-[#effaf2]"
                        >
                          Abrir
                        </Link>
                        <Link
                          href={`/admin/correcao/${attempt.id}/pdf`}
                          className="rounded-md bg-[#000060] px-3 py-2 text-sm font-semibold text-white hover:bg-[#000044]"
                        >
                          PDF
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {attempts.length === 0 ? (
          <div className="mt-4 rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-4 text-sm text-[#5d6480]">
            Ainda nao ha provas enviadas.
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
