import Link from "next/link";
import { createEventAction } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminRole } from "@/generated/prisma/client";
import { formatDateInput, formatDateLabel } from "@/lib/application-availability";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type EventsPageProps = {
  searchParams?: Promise<{
    erro?: string;
  }>;
};

function isEventManager(role: AdminRole) {
  return role === AdminRole.ADMIN || role === AdminRole.ADMIN_TEACHER;
}

function getDefaultEndDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return formatDateInput(date);
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const context = await requireAdminContext();
  const params = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;
  const scopedChurchFilter = scopedChurchId || "__missing_church__";
  const canManageEvents = isEventManager(context.role);

  const events = await prisma.event.findMany({
    where: isTeacher
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
      : {},
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          applications: true,
          registrations: isTeacher
            ? {
                where: {
                  student: {
                    churchId: scopedChurchFilter,
                  },
                },
              }
            : true,
        },
      },
    },
  });

  return (
    <AdminShell title="Eventos" description="Organize provas por evento e controle a inscricao de cada ER ou MR.">
      {isTeacher && !scopedChurchId ? (
        <div className="mb-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-4 py-3 text-sm text-[#b00018]">
          Seu usuario de conselheiro ainda nao esta vinculado a uma igreja.
        </div>
      ) : null}
      {params.erro ? (
        <div className="mb-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-4 py-3 text-sm text-[#b00018]">
          {params.erro}
        </div>
      ) : null}

      {canManageEvents ? (
        <section className="mb-5 rounded-lg border border-[#d8def0] bg-white p-4">
          <h2 className="text-lg font-semibold">Novo evento</h2>
          <form action={createEventAction} className="mt-4 grid gap-3 lg:grid-cols-4">
            <label className="block lg:col-span-2">
              <span className="text-sm font-medium">Titulo do evento</span>
              <input
                name="title"
                required
                minLength={3}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
                placeholder="Ex.: Evento regional 2026"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Inicio</span>
              <input
                name="startsAt"
                type="date"
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Fim</span>
              <input
                name="endsAt"
                type="date"
                defaultValue={getDefaultEndDate()}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              />
            </label>
            <label className="block lg:col-span-3">
              <span className="text-sm font-medium">Descricao opcional</span>
              <textarea
                name="description"
                rows={2}
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
                defaultValue={1}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              />
            </label>
            <div className="lg:col-span-4">
              <button className="rounded-md bg-[#000060] px-5 py-3 text-sm font-semibold text-white hover:bg-[#000044]">
                Criar evento
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-lg border border-[#d8def0] bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Eventos cadastrados</h2>
            <p className="text-sm text-[#5d6480]">
              Abra um evento para vincular provas e cadastrar as inscricoes.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/admin/eventos/${event.id}`}
              className="grid gap-3 rounded-md border border-[#e8ecf8] p-4 transition hover:border-[#000060] lg:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">{event.title}</h3>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      event.active ? "bg-[#effaf2] text-[#1f623e]" : "bg-[#f2f4fb] text-[#5d6480]"
                    }`}
                  >
                    {event.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                {event.description ? (
                  <p className="mt-1 text-sm text-[#5d6480]">{event.description}</p>
                ) : null}
                <p className="mt-2 text-sm text-[#5d6480]">
                  {formatDateLabel(event.startsAt, "Inicio imediato")} ate {formatDateLabel(event.endsAt, "sem fim definido")}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm lg:min-w-80">
                <div className="rounded-md bg-[#f8faff] px-3 py-2">
                  <p className="text-xs text-[#5d6480]">Provas</p>
                  <p className="font-semibold">{event._count.applications}</p>
                </div>
                <div className="rounded-md bg-[#f8faff] px-3 py-2">
                  <p className="text-xs text-[#5d6480]">Inscricoes</p>
                  <p className="font-semibold">{event._count.registrations}</p>
                </div>
                <div className="rounded-md bg-[#f8faff] px-3 py-2">
                  <p className="text-xs text-[#5d6480]">Limite</p>
                  <p className="font-semibold">{event.maxApplicationsPerParticipant}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {events.length === 0 ? (
          <div className="mt-4 rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-4 text-sm text-[#5d6480]">
            Nenhum evento cadastrado ainda.
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
