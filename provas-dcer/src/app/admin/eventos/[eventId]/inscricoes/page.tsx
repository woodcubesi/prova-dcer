import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  EventRegistrationForm,
  type EventRegistrationInitialValues,
} from "@/components/admin/EventRegistrationForm";
import { EventRegistrationsList } from "@/components/admin/EventRegistrationsList";
import { AdminRole } from "@/generated/prisma/client";
import { formatDateLabel } from "@/lib/application-availability";
import { getEventApplicationTypeLabel } from "@/lib/events";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type EventRegistrationsPageProps = {
  params: Promise<{
    eventId: string;
  }>;
  searchParams?: Promise<{
    erro?: string;
    ok?: string;
    modo?: string;
    igreja?: string;
    aluno?: string;
    lider?: string;
    funcao?: string;
    nome?: string;
    categoria?: string;
    programa?: string;
    nascimento?: string;
    provas?: string;
  }>;
};

function isEventManager(role: AdminRole) {
  return role === AdminRole.ADMIN || role === AdminRole.ADMIN_TEACHER;
}

function getInitialValues(
  params: Awaited<NonNullable<EventRegistrationsPageProps["searchParams"]>>,
  fallbackChurchId: string,
  fallbackLeaderUserId: string,
): EventRegistrationInitialValues {
  const mode = params.modo === "adhoc" ? "adhoc" : "existing";

  return {
    mode,
    churchId: params.igreja || fallbackChurchId,
    studentId: params.aluno || "",
    name: params.nome || "",
    category: params.categoria || "",
    program: params.programa === "MR" ? "MR" : "ER",
    birthDate: params.nascimento || "",
    leaderUserId: params.lider || fallbackLeaderUserId,
    leaderRole: params.funcao || "CONSELHEIRO",
    eventApplicationIds: params.provas ? params.provas.split(",").filter(Boolean) : [],
  };
}

export default async function EventRegistrationsPage({ params, searchParams }: EventRegistrationsPageProps) {
  const context = await requireAdminContext();
  const { eventId } = await params;
  const query = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;
  const scopedChurchFilter = scopedChurchId || "__missing_church__";
  const canManageEvents = isEventManager(context.role);

  const [event, students, churches, leaders] = await Promise.all([
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
              },
            },
          },
        },
        registrations: {
          where: isTeacher ? { churchId: scopedChurchFilter } : {},
          orderBy: { createdAt: "desc" },
          include: {
            church: true,
            assignments: {
              orderBy: { createdAt: "asc" },
              include: {
                eventApplication: {
                  include: {
                    application: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
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

  const registeredStudentIds = new Set(event.registrations.flatMap((registration) => (
    registration.studentId ? [registration.studentId] : []
  )));
  const defaultLeaderUserId = leaders.some((leader) => leader.id === context.user?.id) ? context.user?.id || "" : "";
  const initialValues = getInitialValues(query, scopedChurchId || "", defaultLeaderUserId);

  return (
    <AdminShell title={`Inscricoes - ${event.title}`} description="Cadastre participantes e libere as provas deste evento.">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/admin/eventos" className="text-sm font-semibold text-[#000060]">
          Voltar para eventos
        </Link>
        {canManageEvents ? (
          <Link
            href={`/admin/eventos/${event.id}`}
            className="rounded-md border border-[#000060] px-3 py-2 text-center text-sm font-semibold text-[#000060] hover:bg-[#f7f8ff]"
          >
            Configurar evento
          </Link>
        ) : null}
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
          <p className="text-sm text-[#5d6480]">Provas disponiveis</p>
          <p className="mt-1 text-2xl font-semibold">{event.applications.length}</p>
        </div>
        <div className="rounded-lg border border-[#d8def0] bg-white p-4">
          <p className="text-sm text-[#5d6480]">Inscricoes</p>
          <p className="mt-1 text-2xl font-semibold">{event.registrations.length}</p>
        </div>
      </section>

      <section className="mb-5 rounded-lg border border-[#d8def0] bg-white p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Nova inscricao</h2>
          <p className="text-sm text-[#5d6480]">
            Escolha a igreja primeiro. Depois selecione um ER/MR cadastrado ou use o modo avulso somente para este evento.
          </p>
        </div>
        <div className="mt-4">
          <EventRegistrationForm
            eventId={event.id}
            maxApplicationsPerParticipant={event.maxApplicationsPerParticipant}
            churches={churches.map((church) => ({
              id: church.id,
              name: church.name,
              embassyName: church.embassyName,
            }))}
            students={students.map((student) => ({
              id: student.id,
              name: student.name,
              category: student.category,
              program: student.program,
              churchId: student.churchId,
              churchName: student.church.name,
              alreadyRegistered: registeredStudentIds.has(student.id),
            }))}
            leaders={leaders.map((leader) => ({
              id: leader.id,
              name: leader.name,
              churchId: leader.churchId,
              churchName: leader.church?.name || null,
            }))}
            applications={event.applications.map((eventApplication) => ({
              id: eventApplication.id,
              title: eventApplication.application.title,
              examTitle: eventApplication.application.exam.title,
              typeLabel: getEventApplicationTypeLabel(eventApplication.type),
            }))}
            initialValues={initialValues}
          />
        </div>
      </section>

      <section className="rounded-lg border border-[#d8def0] bg-white p-4">
        <h2 className="text-lg font-semibold">Inscricoes cadastradas</h2>
        <div className="mt-4">
          <EventRegistrationsList eventId={event.id} registrations={event.registrations} />
        </div>
      </section>
    </AdminShell>
  );
}
