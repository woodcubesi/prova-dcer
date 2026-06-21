import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteExamApplicationAction } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { ExamBuilder, type ExamBuilderInitialData } from "@/components/admin/ExamBuilder";
import { AdminRole } from "@/generated/prisma/client";
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

  const [application, churches] = await Promise.all([
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
        _count: {
          select: {
            attempts: true,
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
    churchIds: selectedChurchIds,
    categories: selectedCategories,
    questions: application.exam.questions.map((question) => {
      const correctOptionIndex = question.options.findIndex((option) => option.isCorrect);

      return {
        id: question.id,
        statement: question.statement,
        points: question.points,
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
        <Link href="/admin/provas" className="text-sm font-semibold text-[#2c6d49]">
          Voltar para provas
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/admin/provas/nova"
            className="rounded-md border border-[#2c6d49] px-3 py-2 text-center text-sm font-semibold text-[#2c6d49] hover:bg-[#effaf2]"
          >
            Criar nova prova
          </Link>
          <Link
            href={`/admin/provas/${application.id}/relatorio`}
            className="rounded-md bg-[#12382a] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#1c513d]"
          >
            Relatorio PDF
          </Link>
          <form action={deleteExamApplicationAction}>
            <input type="hidden" name="applicationId" value={application.id} />
            <ConfirmSubmitButton
              message={`Excluir a prova "${application.exam.title}"? Esta acao tambem remove envios e respostas desta aplicacao.`}
              className="w-full rounded-md border border-[#d7b6ad] px-3 py-2 text-center text-sm font-semibold text-[#8d3b2d] hover:bg-[#fff4f2]"
            >
              Excluir prova
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      {isTeacher && !scopedChurchId ? (
        <div className="mb-4 rounded-md border border-[#efc2bd] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b2d20]">
          Seu usuario de professor ainda nao esta vinculado a uma igreja.
        </div>
      ) : null}
      {query.erro ? (
        <div className="mb-4 rounded-md border border-[#efc2bd] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b2d20]">
          {query.erro}
        </div>
      ) : null}

      <ExamBuilder
        mode="edit"
        locked={application._count.attempts > 0}
        initialData={initialData}
        churches={churches.map((church) => ({
          id: church.id,
          name: church.name,
          students: church._count.students,
        }))}
      />
    </AdminShell>
  );
}
