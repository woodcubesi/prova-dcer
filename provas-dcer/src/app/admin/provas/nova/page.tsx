import { AdminShell } from "@/components/admin/AdminShell";
import { ExamBuilder } from "@/components/admin/ExamBuilder";
import { AdminRole } from "@/generated/prisma/client";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type NewExamPageProps = {
  searchParams?: Promise<{
    erro?: string;
  }>;
};

export default async function NewExamPage({ searchParams }: NewExamPageProps) {
  const context = await requireAdminContext();
  const params = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;

  const churches = await prisma.church.findMany({
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
  });

  return (
    <AdminShell
      title="Nova prova"
      description="Monte a prova manualmente. A geracao por IA ficara plugavel em uma proxima etapa."
    >
      {isTeacher && !scopedChurchId ? (
        <div className="mb-4 rounded-md border border-[#efc2bd] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b2d20]">
          Seu usuario de professor ainda nao esta vinculado a uma igreja.
        </div>
      ) : null}

      {params.erro ? (
        <div className="mb-4 rounded-md border border-[#efc2bd] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b2d20]">
          {params.erro}
        </div>
      ) : null}

      {churches.length === 0 ? (
        <div className="rounded-lg border border-[#dfe6dd] bg-white p-5 text-sm text-[#66736a]">
          Cadastre pelo menos uma igreja e um aluno antes de criar a prova.
        </div>
      ) : (
        <ExamBuilder
          churches={churches.map((church) => ({
            id: church.id,
            name: church.name,
            students: church._count.students,
          }))}
        />
      )}
    </AdminShell>
  );
}
