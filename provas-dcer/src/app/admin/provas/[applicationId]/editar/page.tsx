import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteExamApplicationAction } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { ExamBuilder, type ExamBuilderInitialData } from "@/components/admin/ExamBuilder";
import { AdminRole } from "@/generated/prisma/client";
import { formatDateInput } from "@/lib/application-availability";
import { type CategoryCode } from "@/lib/categories";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type EditExamPageProps = {
  params: Promise<{
    applicationId: string;
  }>;
  searchParams?: Promise<{
    erro?: string;
    ok?: string;
  }>;
};

function uniqueValues<T>(values: T[]) {
  return Array.from(new Set(values));
}

export default async function EditExamPage({ params, searchParams }: EditExamPageProps) {
  const context = await requireAdminContext();
  const { applicationId } = await params;
  const query = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;

  const [application, churches, events] = await Promise.all([
    prisma.examApplication.findFirst({
      where: {
        id: applicationId,
        ...(isTeacher
          ? {
              participants: {
                some: {
                  student: {
                    churchId: scopedChurchId || "__missing_church__",
                  },
                },
              },
            }
          : {}),
      },
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
        participants: {
          include: {
            student: {
              select: {
                churchId: true,
                category: true,
              },
            },
          },
        },
        eventApplications: {
          take: 1,
          select: {
            eventId: true,
            type: true,
          },
        },
        _count: {
          select: {
            attempts: true,
            participants: true,
          },
        },
      },
    }),
    prisma.church.findMany({
      where: {
        active: true,
        ...(isTeacher ? { id: scopedChurchId || "__missing_church__" } : {}),
      },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { students: true },
        },
      },
    }),
    prisma.event.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
      },
    }),
  ]);

  if (!application) {
    notFound();
  }

  const selectedChurchIds = uniqueValues(
    application.participants.map((participant) => participant.student.churchId),
  );
  const selectedCategories = uniqueValues(
    application.participants.map((participant) => participant.student.category as CategoryCode),
  );

  const initialData: ExamBuilderInitialData = {
    applicationId: application.id,
    title: application.exam.title,
    description: application.exam.description || "",
    durationMinutes: application.exam.durationMinutes,
    passingPercent: application.exam.passingPercent ?? 70,
    applicationTitle: application.title,
    accessCode: application.accessCode,
    eventId: application.eventApplications[0]?.eventId || "",
    eventApplicationType: application.eventApplications[0]?.type || "GERAL",
    startsAt: formatDateInput(application.startsAt),
    endsAt: formatDateInput(application.endsAt),
    purgeAt: formatDateInput(application.purgeAt),
    churchIds: selectedChurchIds,
    categories: selectedCategories,
    questions: application.exam.questions.map((question) => {
      const correctOptionIndex = question.options.findIndex((option) => option.isCorrect);

      return {
        id: question.id,
        statement: question.statement,
        points: question.points,
        category: question.category ? (question.category as CategoryCode) : undefined,
        theme: question.theme || "",
        difficulty: question.difficulty || "",
        bibleReference: question.bibleReference || "",
        explanation: question.explanation || "",
        sourceStatus: question.sourceStatus || "",
        active: question.active,
        correctOptionIndex: correctOptionIndex >= 0 ? correctOptionIndex : 0,
        options: question.options.map((option) => ({
          label: option.label,
          text: option.text,
        })),
      };
    }),
  };

  return (
    <AdminShell title="Editar prova" description="Atualize dados, participantes, questoes e gabarito da aplicacao.">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/admin/provas" className="text-sm font-semibold text-[#000060]">
          Voltar para provas
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/admin/provas/nova"
            className="rounded-md border border-[#000060] px-3 py-2 text-center text-sm font-semibold text-[#000060] hover:bg-[#effaf2]"
          >
            Criar nova prova
          </Link>
          <Link
            href={`/admin/provas/${application.id}/relatorio`}
            className="rounded-md bg-[#000060] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#000044]"
          >
            Relatorio PDF
          </Link>
          <form action={deleteExamApplicationAction}>
            <input type="hidden" name="applicationId" value={application.id} />
            <ConfirmSubmitButton
              message={`Excluir a prova "${application.exam.title}"? Esta acao tambem remove envios e respostas desta aplicacao.`}
              className="w-full rounded-md border border-[#efb6bf] px-3 py-2 text-center text-sm font-semibold text-[#b00018] hover:bg-[#fff4f2]"
            >
              Excluir prova
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      {isTeacher && !scopedChurchId ? (
        <div className="mb-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-4 py-3 text-sm text-[#b00018]">
          Seu usuario de conselheiro ainda nao esta vinculado a uma igreja.
        </div>
      ) : null}
      {query.erro ? (
        <div className="mb-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-4 py-3 text-sm text-[#b00018]">
          {query.erro}
        </div>
      ) : null}
      {query.ok === "aluno-vinculado" ? (
        <div className="mb-4 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Aluno vinculado a esta prova.
        </div>
      ) : null}
      {query.ok === "aluno-desvinculado" ? (
        <div className="mb-4 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Aluno desvinculado desta prova.
        </div>
      ) : null}

      <section className="mb-5 rounded-lg border border-[#d8def0] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Participantes da prova</h2>
            <p className="text-sm text-[#5d6480]">
              {application._count.participants} aluno(s) vinculado(s). Gerencie a lista em uma tela separada para manter
              este cadastro limpo.
            </p>
          </div>
          <Link
            href={`/admin/provas/${application.id}/participantes`}
            className="rounded-md bg-[#000060] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#000044]"
          >
            Ver alunos vinculados
          </Link>
        </div>
      </section>

      <ExamBuilder
        mode="edit"
        locked={application._count.attempts > 0}
        initialData={initialData}
        churches={churches.map((church) => ({
          id: church.id,
          name: church.name,
          students: church._count.students,
        }))}
        events={events}
      />
    </AdminShell>
  );
}
