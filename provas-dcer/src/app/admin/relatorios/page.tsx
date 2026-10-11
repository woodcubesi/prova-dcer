import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminRole, AttemptStatus, Category } from "@/generated/prisma/client";
import { requireAdminContext } from "@/lib/auth";
import { CATEGORIES, getCategoryLabel } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { formatPercent, formatScore, getApprovalResult } from "@/lib/report-metrics";
import { formatDuration } from "@/lib/text";

export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams?: Promise<{
    categoria?: string;
    evento?: string;
    igreja?: string;
    prova?: string;
  }>;
};

type RankingRow = {
  applicationTitle: string;
  category: string;
  churchName: string;
  examTitle: string;
  participantName: string;
  percent: number;
  registrationCode: string;
  score: number;
  status: string;
  timeUsedSeconds?: number | null;
  totalPoints: number;
};

function isCategory(value?: string): value is Category {
  return Boolean(value && Object.values(Category).includes(value as Category));
}

function compareRankingRows(first: RankingRow, second: RankingRow) {
  const percentDiff = second.percent - first.percent;
  if (percentDiff !== 0) return percentDiff;

  const scoreDiff = second.score - first.score;
  if (scoreDiff !== 0) return scoreDiff;

  const firstTime = first.timeUsedSeconds ?? Number.MAX_SAFE_INTEGER;
  const secondTime = second.timeUsedSeconds ?? Number.MAX_SAFE_INTEGER;
  const timeDiff = firstTime - secondTime;
  if (timeDiff !== 0) return timeDiff;

  return first.participantName.localeCompare(second.participantName, "pt-BR");
}

function statusLabel(status: string) {
  if (status === AttemptStatus.SUBMITTED) return "Enviada";
  if (status === AttemptStatus.EXPIRED) return "Expirada";
  return status;
}

function buildReportsHref(params: Record<string, string | undefined>, overrides: Record<string, string>) {
  const nextParams = new URLSearchParams();

  Object.entries({ ...params, ...overrides }).forEach(([key, value]) => {
    if (value) nextParams.set(key, value);
  });

  const query = nextParams.toString();
  return query ? `/admin/relatorios?${query}` : "/admin/relatorios";
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const context = await requireAdminContext();
  const params = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;
  const scopedChurchFilter = scopedChurchId || "__missing_church__";

  const churchOptions = await prisma.church.findMany({
    where: {
      active: true,
      ...(isTeacher ? { id: scopedChurchFilter } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      embassyName: true,
    },
  });
  const churchIds = new Set(churchOptions.map((church) => church.id));
  const selectedChurchId =
    scopedChurchId || (params.igreja && churchIds.has(params.igreja) ? params.igreja : "");
  const reportChurchFilter = isTeacher ? scopedChurchFilter : selectedChurchId;

  const [applications, events] = await Promise.all([
    prisma.examApplication.findMany({
      where: {
        participants: {
          some: {
            student: reportChurchFilter
              ? {
                  churchId: reportChurchFilter,
                }
              : {
                  church: {
                    active: true,
                  },
                },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        exam: {
          select: {
            title: true,
            passingPercent: true,
          },
        },
        _count: {
          select: {
            participants: reportChurchFilter
              ? {
                  where: {
                    student: {
                      churchId: reportChurchFilter,
                    },
                  },
                }
              : true,
            attempts: reportChurchFilter
              ? {
                  where: {
                    student: {
                      churchId: reportChurchFilter,
                    },
                    status: AttemptStatus.SUBMITTED,
                  },
                }
              : {
                  where: {
                    status: AttemptStatus.SUBMITTED,
                  },
                },
          },
        },
      },
    }),
    prisma.event.findMany({
      where: {
        registrations: {
          some: reportChurchFilter ? { churchId: reportChurchFilter } : {},
        },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        applications: {
          orderBy: { createdAt: "asc" },
          include: {
            application: {
              include: {
                exam: {
                  select: {
                    title: true,
                  },
                },
                _count: {
                  select: {
                    attempts: reportChurchFilter
                      ? {
                          where: {
                            eventRegistration: {
                              churchId: reportChurchFilter,
                            },
                            status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED] },
                          },
                        }
                      : {
                          where: {
                            eventRegistrationId: { not: null },
                            status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED] },
                          },
                        },
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            registrations: reportChurchFilter ? { where: { churchId: reportChurchFilter } } : true,
          },
        },
      },
    }),
  ]);
  const selectedChurch = churchOptions.find((church) => church.id === selectedChurchId) || null;
  const selectedEventId = events.some((event) => event.id === params.evento) ? params.evento || "" : "";
  const selectedEvent = events.find((event) => event.id === selectedEventId) || null;
  const eventApplications = selectedEvent?.applications || [];
  const selectedApplicationId = eventApplications.some(
    (eventApplication) => eventApplication.applicationId === params.prova,
  )
    ? params.prova || ""
    : "";
  const selectedCategory = isCategory(params.categoria) ? params.categoria : "";

  const rankingAttempts = selectedEvent
    ? await prisma.attempt.findMany({
        where: {
          eventRegistration: {
            eventId: selectedEvent.id,
            ...(reportChurchFilter ? { churchId: reportChurchFilter } : {}),
            ...(selectedCategory ? { category: selectedCategory } : {}),
          },
          status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED] },
          ...(selectedApplicationId ? { applicationId: selectedApplicationId } : {}),
        },
        orderBy: [{ submittedAt: "asc" }, { startedAt: "asc" }],
        take: 500,
        include: {
          application: {
            include: {
              exam: {
                select: {
                  title: true,
                },
              },
            },
          },
          eventRegistration: {
            include: {
              church: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      })
    : [];
  const rankingRows = rankingAttempts
    .filter((attempt) => attempt.eventRegistration)
    .map((attempt) => {
      const score = attempt.score ?? 0;
      const totalPoints = attempt.totalPoints ?? 0;
      const result = getApprovalResult(score, totalPoints, 0);

      return {
        applicationTitle: attempt.application.title,
        category: attempt.eventRegistration?.category || Category.JUNIOR,
        churchName: attempt.eventRegistration?.church.name || "-",
        examTitle: attempt.application.exam.title,
        participantName: attempt.eventRegistration?.name || "-",
        percent: result.percent,
        registrationCode: attempt.eventRegistration?.registrationCode || "-",
        score,
        status: attempt.status,
        timeUsedSeconds: attempt.timeUsedSeconds,
        totalPoints,
      };
    })
    .sort(compareRankingRows);
  const selectedApplication = eventApplications.find(
    (eventApplication) => eventApplication.applicationId === selectedApplicationId,
  );
  const pdfParams = new URLSearchParams();
  if (selectedApplicationId) pdfParams.set("prova", selectedApplicationId);
  if (selectedCategory) pdfParams.set("categoria", selectedCategory);
  const pdfHref = selectedEvent
    ? `/admin/relatorios/eventos/${selectedEvent.id}/ranking${pdfParams.toString() ? `?${pdfParams.toString()}` : ""}`
    : "";
  const currentParams = {
    categoria: selectedCategory,
    evento: selectedEventId,
    igreja: selectedChurchId,
    prova: selectedApplicationId,
  };

  return (
    <AdminShell title="Relatorios" description="Baixe resultados, rankings e documentos de acompanhamento.">
      {isTeacher && !scopedChurchId ? (
        <div className="mb-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-4 py-3 text-sm text-[#b00018]">
          Seu usuario de conselheiro ainda nao esta vinculado a uma igreja.
        </div>
      ) : null}

      <section className="mb-5 rounded-lg border border-[#d8def0] bg-white p-4">
        <h2 className="text-lg font-semibold">Ranking de evento</h2>
        <form action="/admin/relatorios" className="mt-4 grid gap-3 lg:grid-cols-4 lg:items-end">
          <label className="block">
            <span className="text-sm font-medium">Igreja</span>
            <select
              name="igreja"
              defaultValue={selectedChurchId}
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
            >
              {churchOptions.length === 0 ? <option value="">Nenhuma igreja cadastrada</option> : null}
              {!isTeacher && churchOptions.length > 0 ? <option value="">Todas as igrejas</option> : null}
              {churchOptions.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.embassyName ? `${church.name} - ${church.embassyName}` : church.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Evento</span>
            <select
              name="evento"
              defaultValue={selectedEventId}
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
            >
              <option value="">Selecione o evento</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Prova/modalidade</span>
            <select
              name="prova"
              defaultValue={selectedApplicationId}
              disabled={!selectedEvent}
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f2f4fb]"
            >
              <option value="">{selectedEvent ? "Todas as provas" : "Escolha o evento primeiro"}</option>
              {eventApplications.map((eventApplication) => (
                <option key={eventApplication.id} value={eventApplication.applicationId}>
                  {eventApplication.application.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Categoria</span>
            <select
              name="categoria"
              defaultValue={selectedCategory}
              disabled={!selectedEvent}
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f2f4fb]"
            >
              <option value="">{selectedEvent ? "Todas as categorias" : "Escolha o evento primeiro"}</option>
              {CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row lg:col-span-4">
            <button className="rounded-md bg-[#000060] px-4 py-3 text-sm font-semibold text-white hover:bg-[#000044]">
              Gerar ranking
            </button>
            {pdfHref ? (
              <Link
                href={pdfHref}
                className="rounded-md border border-[#000060] px-4 py-3 text-center text-sm font-semibold text-[#000060] hover:bg-[#effaf2]"
              >
                Baixar PDF do ranking
              </Link>
            ) : null}
          </div>
        </form>
        <p className="mt-3 text-sm text-[#5d6480]">
          {selectedChurch
            ? `Exibindo apenas ${selectedChurch.name}.`
            : isTeacher
              ? "Nenhuma igreja vinculada ao seu usuario."
              : "Exibindo dados de todas as igrejas."}
        </p>
      </section>

      <section className="mb-5 rounded-lg border border-[#d8def0] bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Previa do ranking</h2>
            <p className="text-sm text-[#5d6480]">
              {selectedEvent
                ? `${selectedEvent.title} - ${selectedApplication?.application.title || "todas as provas"} - ${
                    selectedCategory ? getCategoryLabel(selectedCategory) : "todas as categorias"
                  }`
                : "Escolha um evento para visualizar a classificacao."}
            </p>
          </div>
          <span className="rounded-full bg-[#f8faff] px-3 py-1 text-sm text-[#5d6480]">
            {rankingRows.length} resultado(s)
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[#d8def0] text-xs uppercase tracking-wide text-[#5d6480]">
              <tr>
                <th className="py-3 pr-4">Colocacao</th>
                <th className="py-3 pr-4">Nome</th>
                <th className="py-3 pr-4">Igreja</th>
                <th className="py-3 pr-4">Categoria</th>
                <th className="py-3 pr-4">Prova</th>
                <th className="py-3 pr-4">Pontuacao</th>
                <th className="py-3 pr-4">Acertos</th>
                <th className="py-3 pr-4">Tempo</th>
                <th className="py-3 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {rankingRows.map((row, index) => (
                <tr
                  key={`${row.registrationCode}-${row.applicationTitle}-${index}`}
                  className="border-b border-[#e8ecf8] last:border-0"
                >
                  <td className="py-3 pr-4 font-semibold">{index + 1}º lugar</td>
                  <td className="py-3 pr-4">
                    <p className="font-medium">{row.participantName}</p>
                    <p className="font-mono text-xs text-[#5d6480]">{row.registrationCode}</p>
                  </td>
                  <td className="py-3 pr-4">{row.churchName}</td>
                  <td className="py-3 pr-4">{getCategoryLabel(row.category)}</td>
                  <td className="py-3 pr-4">
                    <p className="font-medium">{row.applicationTitle}</p>
                    <p className="text-xs text-[#5d6480]">{row.examTitle}</p>
                  </td>
                  <td className="py-3 pr-4">{`${formatScore(row.score)} / ${formatScore(row.totalPoints)}`}</td>
                  <td className="py-3 pr-4">{formatPercent(row.percent)}</td>
                  <td className="py-3 pr-4">{row.timeUsedSeconds ? formatDuration(row.timeUsedSeconds) : "-"}</td>
                  <td className="py-3 pr-4">{statusLabel(row.status)}</td>
                </tr>
              ))}
              {rankingRows.length === 0 ? (
                <tr>
                  <td className="py-6 pr-4 text-sm text-[#5d6480]" colSpan={9}>
                    {selectedEvent
                      ? "Nenhum resultado finalizado para este filtro."
                      : "Selecione um evento para carregar o ranking."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-lg border border-[#d8def0] bg-white p-4">
          <h2 className="text-lg font-semibold">Provas normais</h2>
          <p className="text-sm text-[#5d6480]">Relatorio individual por aplicacao, com ranking e pendencias.</p>
          <div className="mt-4 grid gap-3">
            {applications.map((application) => (
              <div key={application.id} className="rounded-md border border-[#e8ecf8] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{application.exam.title}</p>
                    <p className="text-sm text-[#5d6480]">{application.title}</p>
                    <p className="mt-1 text-xs text-[#5d6480]">
                      {application._count.participants} participante(s) - {application._count.attempts} envio(s)
                    </p>
                  </div>
                  <Link
                    href={`/admin/provas/${application.id}/relatorio`}
                    className="rounded-md bg-[#000060] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#000044]"
                  >
                    Baixar PDF
                  </Link>
                </div>
              </div>
            ))}
            {applications.length === 0 ? (
              <div className="rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-4 text-sm text-[#5d6480]">
                Nenhuma prova normal encontrada para este filtro.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-[#d8def0] bg-white p-4">
          <h2 className="text-lg font-semibold">Eventos cadastrados</h2>
          <p className="text-sm text-[#5d6480]">Atalhos para selecionar rapidamente um evento.</p>
          <div className="mt-4 grid gap-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-md border border-[#e8ecf8] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{event.title}</p>
                    <p className="text-sm text-[#5d6480]">{event._count.registrations} inscricao(oes)</p>
                  </div>
                  <Link
                    href={buildReportsHref(currentParams, { evento: event.id, prova: "", categoria: "" })}
                    className="rounded-md border border-[#000060] px-3 py-2 text-center text-sm font-semibold text-[#000060] hover:bg-[#effaf2]"
                  >
                    Ver ranking
                  </Link>
                </div>
              </div>
            ))}
            {events.length === 0 ? (
              <div className="rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-4 text-sm text-[#5d6480]">
                Nenhum evento encontrado para este filtro.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
