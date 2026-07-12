import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  addEventApplicationAction,
  removeEventApplicationAction,
  updateEventAction,
} from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { AdminRole, EventApplicationType } from "@/generated/prisma/client";
import { formatDateInput, formatDateLabel } from "@/lib/application-availability";
import {
  EVENT_APPLICATION_TYPE_LABELS,
  getEventApplicationTypeLabel,
} from "@/lib/events";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type EventDetailPageProps = {
  params: Promise<{
    eventId: string;
  }>;
  searchParams?: Promise<{
    erro?: string;
    ok?: string;
  }>;
};

function isEventManager(role: AdminRole) {
  return role === AdminRole.ADMIN || role === AdminRole.ADMIN_TEACHER;
}

export default async function EventDetailPage({ params, searchParams }: EventDetailPageProps) {
  const context = await requireAdminContext();
  const { eventId } = await params;
  const query = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;
  const scopedChurchFilter = scopedChurchId || "__missing_church__";
  const canManageEvents = isEventManager(context.role);

  const [event, availableApplications] = await Promise.all([
    prisma.event.findFirst({
      where: {
        id: eventId,
        ...(isTeacher
          ? {
              applications: {
                some: {
                  application: {
                    participants: {
                      some: {
                        student: {
                          churchId: scopedChurchFilter,
                        },
                      },
                    },
                  },
                },
              },
            }
          : {}),
      },
      include: {
        applications: {
          orderBy: { createdAt: "asc" },
          include: {
            application: {
              include: {
                exam: true,
                _count: {
                  select: {
                    attempts: true,
                    participants: true,
                  },
                },
              },
            },
            _count: {
              select: {
                registrations: true,
              },
            },
          },
        },
        registrations: {
          where: isTeacher
            ? {
                churchId: scopedChurchFilter,
              }
            : {},
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
          },
        },
      },
    }),
    canManageEvents
      ? prisma.examApplication.findMany({
          where: {
            eventApplications: {
              none: {
                eventId,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          include: {
            exam: true,
            _count: {
              select: {
                participants: true,
                attempts: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  if (!event) {
    notFound();
  }

  if (!canManageEvents) {
    redirect(`/admin/eventos/${event.id}/inscricoes`);
  }

  return (
    <AdminShell title={event.title} description="Configure os dados do evento e as provas vinculadas.">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/admin/eventos" className="text-sm font-semibold text-[#000060]">
          Voltar para eventos
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/admin/eventos/${event.id}/inscricoes`}
            className="rounded-md bg-[#000060] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#000044]"
          >
            Inscricoes do evento
          </Link>
          <Link
            href="/admin/provas"
            className="rounded-md border border-[#000060] px-3 py-2 text-center text-sm font-semibold text-[#000060] hover:bg-[#effaf2]"
          >
            Ver provas
          </Link>
        </div>
      </div>

      {query.erro ? (
        <div className="mb-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-4 py-3 text-sm text-[#b00018]">
          {query.erro}
        </div>
      ) : null}
      {query.ok ? (
        <div className="mb-4 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Alteracao salva com sucesso.
        </div>
      ) : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[#d8def0] bg-white p-4">
          <p className="text-sm text-[#5d6480]">Status</p>
          <p className="mt-1 text-2xl font-semibold">{event.active ? "Ativo" : "Inativo"}</p>
        </div>
        <div className="rounded-lg border border-[#d8def0] bg-white p-4">
          <p className="text-sm text-[#5d6480]">Periodo</p>
          <p className="mt-1 text-sm font-semibold">
            {formatDateLabel(event.startsAt, "Inicio imediato")} ate {formatDateLabel(event.endsAt, "sem fim definido")}
          </p>
        </div>
        <div className="rounded-lg border border-[#d8def0] bg-white p-4">
          <p className="text-sm text-[#5d6480]">Provas vinculadas</p>
          <p className="mt-1 text-2xl font-semibold">{event.applications.length}</p>
        </div>
        <div className="rounded-lg border border-[#d8def0] bg-white p-4">
          <p className="text-sm text-[#5d6480]">Provas por inscrito</p>
          <p className="mt-1 text-2xl font-semibold">{event.maxApplicationsPerParticipant}</p>
        </div>
      </section>

      {canManageEvents ? (
        <section className="mb-5 rounded-lg border border-[#d8def0] bg-white p-4">
          <h2 className="text-lg font-semibold">Dados do evento</h2>
          <form action={updateEventAction} className="mt-4 grid gap-3 lg:grid-cols-4">
            <input type="hidden" name="eventId" value={event.id} />
            <label className="block lg:col-span-2">
              <span className="text-sm font-medium">Titulo</span>
              <input
                name="title"
                defaultValue={event.title}
                required
                minLength={3}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Inicio</span>
              <input
                name="startsAt"
                type="date"
                defaultValue={formatDateInput(event.startsAt)}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Fim</span>
              <input
                name="endsAt"
                type="date"
                defaultValue={formatDateInput(event.endsAt)}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              />
            </label>
            <label className="block lg:col-span-2">
              <span className="text-sm font-medium">Descricao</span>
              <textarea
                name="description"
                rows={2}
                defaultValue={event.description || ""}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Provas por inscrito</span>
              <input
                name="maxApplicationsPerParticipant"
                type="number"
                min={1}
                max={20}
                defaultValue={event.maxApplicationsPerParticipant}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              />
            </label>
            <label className="flex items-center gap-3 rounded-md border border-[#d8def0] px-3 py-3 text-sm font-medium lg:mt-6">
              <input name="active" type="checkbox" defaultChecked={event.active} className="h-5 w-5 accent-[#000060]" />
              Evento ativo
            </label>
            <div className="lg:col-span-4">
              <button className="rounded-md bg-[#000060] px-5 py-3 text-sm font-semibold text-white hover:bg-[#000044]">
                Salvar evento
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="mb-5 rounded-lg border border-[#d8def0] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Provas do evento</h2>
            <p className="text-sm text-[#5d6480]">
              Cada prova vinculada pode ser liberada individualmente na inscricao do ER ou MR.
            </p>
          </div>
        </div>

        {canManageEvents ? (
          <form action={addEventApplicationAction} className="mt-4 grid gap-3 lg:grid-cols-[1fr_240px_auto] lg:items-end">
            <input type="hidden" name="eventId" value={event.id} />
            <label className="block">
              <span className="text-sm font-medium">Prova existente</span>
              <select
                name="applicationId"
                className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              >
                <option value="">Selecione uma prova</option>
                {availableApplications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.title} - {application.exam.title} ({application._count.participants} participante(s))
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Tipo</span>
              <select
                name="type"
                defaultValue={EventApplicationType.BIBLICA_ONLINE}
                className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              >
                {Object.entries(EVENT_APPLICATION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded-md bg-[#000060] px-4 py-3 text-sm font-semibold text-white hover:bg-[#000044]">
              Vincular prova
            </button>
          </form>
        ) : null}

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[#d8def0] text-xs uppercase tracking-wide text-[#5d6480]">
              <tr>
                <th className="py-3 pr-4">Prova</th>
                <th className="py-3 pr-4">Tipo</th>
                <th className="py-3 pr-4">Tempo</th>
                <th className="py-3 pr-4">Participantes</th>
                <th className="py-3 pr-4">Inscricoes</th>
                {canManageEvents ? <th className="py-3 pr-4">Acao</th> : null}
              </tr>
            </thead>
            <tbody>
              {event.applications.map((eventApplication) => (
                <tr key={eventApplication.id} className="border-b border-[#e8ecf8] last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{eventApplication.application.title}</p>
                    <p className="text-xs text-[#5d6480]">{eventApplication.application.exam.title}</p>
                  </td>
                  <td className="py-3 pr-4">{getEventApplicationTypeLabel(eventApplication.type)}</td>
                  <td className="py-3 pr-4">{eventApplication.application.exam.durationMinutes} min</td>
                  <td className="py-3 pr-4">{eventApplication.application._count.participants}</td>
                  <td className="py-3 pr-4">{eventApplication._count.registrations}</td>
                  {canManageEvents ? (
                    <td className="py-3 pr-4">
                      <form action={removeEventApplicationAction}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="eventApplicationId" value={eventApplication.id} />
                        <ConfirmSubmitButton
                          message={`Remover "${eventApplication.application.title}" deste evento?`}
                          className="rounded-md border border-[#efb6bf] px-3 py-2 text-sm font-semibold text-[#b00018] hover:bg-[#fff4f2]"
                        >
                          Remover
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  ) : null}
                </tr>
              ))}
              {event.applications.length === 0 ? (
                <tr>
                  <td className="py-6 pr-4 text-sm text-[#5d6480]" colSpan={canManageEvents ? 6 : 5}>
                    Nenhuma prova vinculada a este evento.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-3 md:hidden">
          {event.applications.map((eventApplication) => (
            <div key={eventApplication.id} className="rounded-md border border-[#e8ecf8] p-3">
              <p className="font-medium">{eventApplication.application.title}</p>
              <p className="mt-1 text-sm text-[#5d6480]">{eventApplication.application.exam.title}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-[#f8faff] px-3 py-2">
                  <p className="text-xs text-[#5d6480]">Tipo</p>
                  <p className="font-semibold">{getEventApplicationTypeLabel(eventApplication.type)}</p>
                </div>
                <div className="rounded-md bg-[#f8faff] px-3 py-2">
                  <p className="text-xs text-[#5d6480]">Tempo</p>
                  <p className="font-semibold">{eventApplication.application.exam.durationMinutes} min</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#d8def0] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Inscricoes do evento</h2>
            <p className="text-sm text-[#5d6480]">
              As inscricoes ficam em uma tela propria para escolha de igreja, ER/MR ou inscrito avulso.
            </p>
          </div>
          <Link
            href={`/admin/eventos/${event.id}/inscricoes`}
            className="rounded-md bg-[#000060] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#000044]"
          >
            Abrir inscricoes
          </Link>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md bg-[#f8faff] px-3 py-2">
            <p className="text-xs text-[#5d6480]">Inscricoes cadastradas</p>
            <p className="font-semibold">{event.registrations.length}</p>
          </div>
          <div className="rounded-md bg-[#f8faff] px-3 py-2">
            <p className="text-xs text-[#5d6480]">Limite de provas por inscrito</p>
            <p className="font-semibold">{event.maxApplicationsPerParticipant}</p>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
