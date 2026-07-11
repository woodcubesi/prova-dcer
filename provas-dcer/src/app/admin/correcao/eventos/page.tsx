import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminRole, AttemptStatus } from "@/generated/prisma/client";
import { getCategoryLabel } from "@/lib/categories";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/text";

export const dynamic = "force-dynamic";

type EventCorrectionPageProps = {
  searchParams?: Promise<{
    evento?: string;
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
    return { label: "Pendente", percent: null, passed: false };
  }

  const percent = (score / totalPoints) * 100;
  return {
    label: percent >= passingPercent ? "Aprovado" : "Reprovado",
    percent,
    passed: percent >= passingPercent,
  };
}

export default async function EventCorrectionPage({ searchParams }: EventCorrectionPageProps) {
  const context = await requireAdminContext();
  const params = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;
  const selectedEventId = String(params.evento || "").trim();
  const selectedApplicationId = String(params.prova || "").trim();
  const finalStatuses = [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED];

  const [events, applications, attempts] = await Promise.all([
    prisma.event.findMany({
      where: {
        registrations: {
          some: {
            attempts: {
              some: { status: { in: finalStatuses } },
            },
            ...(isTeacher ? { churchId: scopedChurchId || "__missing_church__" } : {}),
          },
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
      },
    }),
    prisma.examApplication.findMany({
      where: {
        attempts: {
          some: {
            status: { in: finalStatuses },
            eventRegistrationId: { not: null },
            ...(selectedEventId || isTeacher
              ? {
                  eventRegistration: {
                    ...(selectedEventId ? { eventId: selectedEventId } : {}),
                    ...(isTeacher ? { churchId: scopedChurchId || "__missing_church__" } : {}),
                  },
                }
              : {}),
          },
        },
      },
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
        eventRegistrationId: { not: null },
        ...(selectedApplicationId ? { applicationId: selectedApplicationId } : {}),
        ...(selectedEventId || isTeacher
          ? {
              eventRegistration: {
                ...(selectedEventId ? { eventId: selectedEventId } : {}),
                ...(isTeacher ? { churchId: scopedChurchId || "__missing_church__" } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
      include: {
        eventRegistration: {
          include: {
            church: true,
            event: true,
          },
        },
        application: {
          include: {
            exam: true,
          },
        },
      },
    }),
  ]);

  return (
    <AdminShell title="Correcao de eventos" description="Confira provas feitas pelo numero de inscricao do evento.">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/admin/correcao" className="text-sm font-semibold text-[#000060]">
          Voltar para correcao geral
        </Link>
        <Link
          href="/admin/eventos"
          className="rounded-md border border-[#000060] px-3 py-2 text-center text-sm font-semibold text-[#000060] hover:bg-[#effaf2]"
        >
          Ver eventos
        </Link>
      </div>

      <section className="rounded-lg border border-[#d8def0] bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Provas de eventos recebidas</h2>
            <p className="text-sm text-[#5d6480]">Lista separada das provas por carteirinha oficial.</p>
          </div>
          <span className="rounded-full bg-[#effaf2] px-3 py-1 text-sm font-semibold text-[#1f623e]">
            {attempts.length} envio(s)
          </span>
        </div>

        <form
          action="/admin/correcao/eventos"
          className="mt-4 grid gap-3 rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
        >
          <label className="block">
            <span className="text-sm font-medium">Filtrar por evento</span>
            <select
              name="evento"
              defaultValue={selectedEventId}
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
            >
              <option value="">Todos os eventos</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
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

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="border-b border-[#d8def0] text-xs uppercase tracking-wide text-[#5d6480]">
              <tr>
                <th className="py-3 pr-4">Inscrito</th>
                <th className="py-3 pr-4">Evento</th>
                <th className="py-3 pr-4">Prova</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Tempo</th>
                <th className="py-3 pr-4">Pontuacao</th>
                <th className="py-3 pr-4">Resultado</th>
                <th className="py-3 pr-4">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => {
                const registration = attempt.eventRegistration;
                const passingPercent = attempt.application.exam.passingPercent ?? 70;
                const result = getAttemptResult(attempt.score, attempt.totalPoints, passingPercent);

                return (
                  <tr key={attempt.id} className="border-b border-[#e8ecf8] last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{registration?.name || "-"}</p>
                      <p className="font-mono text-xs text-[#5d6480]">{registration?.registrationCode || "-"}</p>
                      <p className="text-xs text-[#5d6480]">
                        {registration?.church.name || "-"} - {getCategoryLabel(registration?.category || "")}
                      </p>
                    </td>
                    <td className="py-3 pr-4">{registration?.event.title || "-"}</td>
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

        <div className="mt-4 grid gap-3 md:hidden">
          {attempts.map((attempt) => {
            const registration = attempt.eventRegistration;

            return (
              <div key={attempt.id} className="rounded-md border border-[#e8ecf8] p-3">
                <p className="font-medium">{registration?.name || "-"}</p>
                <p className="mt-1 text-sm text-[#5d6480]">
                  {registration?.event.title || "-"} - {registration?.registrationCode || "-"}
                </p>
                <p className="mt-3 text-sm font-medium">{attempt.application.exam.title}</p>
                <p className="text-xs text-[#5d6480]">{attempt.application.title}</p>
                <Link
                  href={`/admin/correcao/${attempt.id}`}
                  className="mt-3 block rounded-md border border-[#000060] px-3 py-2 text-center text-sm font-semibold text-[#000060]"
                >
                  Abrir
                </Link>
              </div>
            );
          })}
        </div>

        {attempts.length === 0 ? (
          <div className="mt-4 rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-4 text-sm text-[#5d6480]">
            Ainda nao ha provas de eventos enviadas.
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
