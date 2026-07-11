import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addEventApplicationAction,
  createEventRegistrationAction,
  deleteEventRegistrationAction,
  removeEventApplicationAction,
  updateEventAction,
} from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { AdminRole, EventApplicationType, EventLeaderRole } from "@/generated/prisma/client";
import { formatDateInput, formatDateLabel } from "@/lib/application-availability";
import { CATEGORIES, getCategoryLabel } from "@/lib/categories";
import {
  EVENT_APPLICATION_TYPE_LABELS,
  EVENT_LEADER_ROLE_LABELS,
  getEventApplicationTypeLabel,
  getEventLeaderRoleLabel,
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

  const [event, availableApplications, students, churches, leaders] = await Promise.all([
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
                student: {
                  churchId: scopedChurchFilter,
                },
              }
            : {},
          orderBy: { createdAt: "desc" },
          include: {
            church: true,
            student: true,
            leaderUser: true,
            assignments: {
              orderBy: { createdAt: "asc" },
              include: {
                eventApplication: {
                  include: {
                    application: {
                      include: {
                        exam: true,
                      },
                    },
                  },
                },
              },
            },
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
    prisma.student.findMany({
      where: {
        active: true,
        ...(isTeacher ? { churchId: scopedChurchFilter } : {}),
      },
      orderBy: [{ church: { name: "asc" } }, { name: "asc" }],
      include: {
        church: true,
      },
    }),
    prisma.church.findMany({
      where: {
        active: true,
        ...(isTeacher ? { id: scopedChurchFilter } : {}),
      },
      orderBy: { name: "asc" },
    }),
    prisma.adminUser.findMany({
      where: {
        active: true,
        role: { in: [AdminRole.TEACHER, AdminRole.ADMIN_TEACHER] },
        ...(isTeacher ? { churchId: scopedChurchFilter } : {}),
      },
      orderBy: [{ church: { name: "asc" } }, { name: "asc" }],
      include: {
        church: true,
      },
    }),
  ]);

  if (!event) {
    notFound();
  }

  const registrationStudentIds = new Set(event.registrations.flatMap((registration) => (
    registration.studentId ? [registration.studentId] : []
  )));

  return (
    <AdminShell title={event.title} description="Cadastre as provas do evento e as inscricoes permitidas.">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/admin/eventos" className="text-sm font-semibold text-[#000060]">
          Voltar para eventos
        </Link>
        <Link
          href="/admin/provas"
          className="rounded-md border border-[#000060] px-3 py-2 text-center text-sm font-semibold text-[#000060] hover:bg-[#effaf2]"
        >
          Ver provas
        </Link>
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

      <section className="mb-5 rounded-lg border border-[#d8def0] bg-white p-4">
        <h2 className="text-lg font-semibold">Inscricao no evento</h2>
        <form action={createEventRegistrationAction} className="mt-4 grid gap-3 lg:grid-cols-2">
          <input type="hidden" name="eventId" value={event.id} />
          <label className="block lg:col-span-2">
            <span className="text-sm font-medium">Importar ER ou MR cadastrado</span>
            <select
              name="studentId"
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
            >
              <option value="">Nao importar, cadastrar somente neste evento</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} - {student.church.name} - {getCategoryLabel(student.category)}
                  {registrationStudentIds.has(student.id) ? " (ja inscrito)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Nome do inscrito avulso</span>
            <input
              name="name"
              minLength={3}
              className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              placeholder="Use quando nao importar do cadastro geral"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Igreja do inscrito avulso</span>
            <select
              name="churchId"
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
            >
              <option value="">Selecione a igreja</option>
              {churches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.embassyName ? `${church.name} - ${church.embassyName}` : church.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Categoria do inscrito avulso</span>
            <select
              name="category"
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
            >
              <option value="">Selecione a categoria</option>
              {CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Nascimento opcional</span>
            <input
              name="birthDate"
              type="date"
              className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Conselheiro ou orientador</span>
            <select
              name="leaderUserId"
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
            >
              <option value="">Selecione no cadastro de equipe</option>
              {leaders.map((leader) => (
                <option key={leader.id} value={leader.id}>
                  {leader.name}
                  {leader.church ? ` - ${leader.church.name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Funcao no evento</span>
            <select
              name="leaderRole"
              defaultValue={EventLeaderRole.CONSELHEIRO}
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
            >
              {Object.entries(EVENT_LEADER_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="lg:col-span-2">
            <legend className="text-sm font-medium">
              Provas permitidas para o inscrito (maximo {event.maxApplicationsPerParticipant})
            </legend>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {event.applications.map((eventApplication) => (
                <label
                  key={eventApplication.id}
                  className="flex items-start gap-3 rounded-md border border-[#e8ecf8] px-3 py-3"
                >
                  <input
                    name="eventApplicationIds"
                    type="checkbox"
                    value={eventApplication.id}
                    className="mt-1 h-5 w-5 accent-[#000060]"
                  />
                  <span>
                    <span className="block text-sm font-medium">{eventApplication.application.title}</span>
                    <span className="text-xs text-[#5d6480]">
                      {getEventApplicationTypeLabel(eventApplication.type)} - {eventApplication.application.exam.title}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {event.applications.length === 0 ? (
              <p className="mt-2 text-sm text-[#5d6480]">Vincule pelo menos uma prova antes de cadastrar inscricoes.</p>
            ) : null}
          </fieldset>
          <div className="lg:col-span-2">
            <button
              disabled={event.applications.length === 0 || churches.length === 0 || leaders.length === 0}
              className="rounded-md bg-[#000060] px-5 py-3 text-sm font-semibold text-white hover:bg-[#000044] disabled:cursor-not-allowed disabled:bg-[#888fa8]"
            >
              Salvar inscricao
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-[#d8def0] bg-white p-4">
        <h2 className="text-lg font-semibold">Inscricoes cadastradas</h2>
        <div className="mt-4 grid gap-3">
          {event.registrations.map((registration) => (
            <div key={registration.id} className="rounded-md border border-[#e8ecf8] p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{registration.name}</p>
                    <span className="rounded-full bg-[#effaf2] px-2 py-1 font-mono text-xs font-semibold text-[#1f623e]">
                      {registration.registrationCode}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#5d6480]">
                    {registration.church.name} - {getCategoryLabel(registration.category)}
                  </p>
                  <p className="mt-1 text-sm text-[#5d6480]">
                    Lider: {registration.leaderName} ({getEventLeaderRoleLabel(registration.leaderRole)})
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/admin/eventos/${event.id}/inscricoes/${registration.id}/cracha`}
                    className="rounded-md bg-[#000060] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#000044]"
                  >
                    Baixar cracha
                  </Link>
                  <form action={deleteEventRegistrationAction}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="registrationId" value={registration.id} />
                    <ConfirmSubmitButton
                      message={`Excluir inscricao de "${registration.name}"?`}
                      className="rounded-md border border-[#efb6bf] px-3 py-2 text-sm font-semibold text-[#b00018] hover:bg-[#fff4f2]"
                    >
                      Excluir inscricao
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {registration.assignments.map((assignment) => (
                  <span key={assignment.id} className="rounded-full bg-[#f8faff] px-3 py-1 text-xs font-semibold text-[#000060]">
                    {assignment.eventApplication.application.title}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {event.registrations.length === 0 ? (
          <div className="mt-4 rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-4 text-sm text-[#5d6480]">
            Nenhuma inscricao cadastrada neste evento.
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
