import Link from "next/link";
import { notFound } from "next/navigation";
import { linkApplicationParticipantAction, unlinkApplicationParticipantAction } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { AdminRole, ApplicationParticipantOverrideMode } from "@/generated/prisma/client";
import { getCategoryLabel, type CategoryCode } from "@/lib/categories";
import { requireAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ParticipantsPageProps = {
  params: Promise<{
    applicationId: string;
  }>;
  searchParams?: Promise<{
    erro?: string;
    ok?: string;
  }>;
};

export default async function ExamParticipantsPage({ params, searchParams }: ParticipantsPageProps) {
  const context = await requireAdminRole([AdminRole.ADMIN, AdminRole.ADMIN_TEACHER]);
  const { applicationId } = await params;
  const query = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;

  const [application, studentOptions] = await Promise.all([
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
          select: {
            title: true,
          },
        },
        participants: {
          orderBy: [
            {
              student: {
                church: {
                  name: "asc",
                },
              },
            },
            {
              student: {
                name: "asc",
              },
            },
          ],
          include: {
            student: {
              select: {
                id: true,
                name: true,
                externalId: true,
                churchId: true,
                category: true,
                church: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        attempts: {
          select: {
            studentId: true,
          },
        },
        participantOverrides: {
          select: {
            studentId: true,
            mode: true,
          },
        },
      },
    }),
    prisma.student.findMany({
      where: {
        active: true,
        ...(isTeacher ? { churchId: scopedChurchId || "__missing_church__" } : {}),
      },
      orderBy: [{ church: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        externalId: true,
        category: true,
        church: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  if (!application) {
    notFound();
  }

  const participantStudentIds = new Set(application.participants.map((participant) => participant.studentId));
  const attemptedStudentIds = new Set(
    application.attempts
      .map((attempt) => attempt.studentId)
      .filter((studentId): studentId is string => Boolean(studentId)),
  );
  const overrideByStudentId = new Map(
    application.participantOverrides.map((override) => [override.studentId, override.mode]),
  );
  const availableStudents = studentOptions.filter((student) => !participantStudentIds.has(student.id));

  return (
    <AdminShell
      title="Alunos vinculados"
      description={`Gerencie os participantes da prova ${application.exam.title}.`}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/admin/provas/${application.id}/editar`} className="text-sm font-semibold text-[#000060]">
          Voltar para edicao da prova
        </Link>
        <Link
          href="/admin/provas"
          className="rounded-md border border-[#000060] px-3 py-2 text-center text-sm font-semibold text-[#000060] hover:bg-[#f7f8ff]"
        >
          Voltar para provas
        </Link>
      </div>

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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Vincular aluno</h2>
            <p className="text-sm text-[#5d6480]">
              Use esta tela para adicionar alunos criados depois da prova ou fazer ajustes manuais.
            </p>
          </div>
          <form action={linkApplicationParticipantAction} className="grid gap-2 sm:grid-cols-[minmax(260px,1fr)_auto]">
            <input type="hidden" name="applicationId" value={application.id} />
            <input type="hidden" name="returnView" value="participantes" />
            <label className="block">
              <span className="sr-only">Aluno para vincular</span>
              <select
                name="studentId"
                className="w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#000060]"
                defaultValue=""
              >
                <option value="">Selecione um aluno</option>
                {availableStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} - {student.church.name} - {getCategoryLabel(student.category as CategoryCode)}
                    {student.externalId ? ` - ${student.externalId}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="rounded-md bg-[#000060] px-4 py-3 text-sm font-semibold text-white hover:bg-[#000044] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={availableStudents.length === 0}
            >
              Vincular aluno
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-lg border border-[#d8def0] bg-white p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Alunos vinculados</h2>
          <p className="text-sm text-[#5d6480]">{application.participants.length} aluno(s) nesta prova.</p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[#d8def0] text-xs uppercase tracking-wide text-[#5d6480]">
              <tr>
                <th className="py-3 pr-4">Aluno</th>
                <th className="py-3 pr-4">Igreja</th>
                <th className="py-3 pr-4">Categoria</th>
                <th className="py-3 pr-4">Vinculo</th>
                <th className="py-3 pr-4">Acao</th>
              </tr>
            </thead>
            <tbody>
              {application.participants.map((participant) => {
                const hasAttempt = attemptedStudentIds.has(participant.studentId);
                const override = overrideByStudentId.get(participant.studentId);
                const linkLabel = override === ApplicationParticipantOverrideMode.INCLUDE ? "Manual" : "Filtro";

                return (
                  <tr key={participant.id} className="border-b border-[#e8ecf8] last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{participant.student.name}</p>
                      {participant.student.externalId ? (
                        <p className="font-mono text-xs text-[#5d6480]">{participant.student.externalId}</p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4">{participant.student.church.name}</td>
                    <td className="py-3 pr-4">{getCategoryLabel(participant.student.category as CategoryCode)}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-[#f8faff] px-2 py-1 text-xs text-[#5d6480]">{linkLabel}</span>
                    </td>
                    <td className="py-3 pr-4">
                      {hasAttempt ? (
                        <span className="text-xs text-[#5d6480]">Tentativa iniciada</span>
                      ) : (
                        <form action={unlinkApplicationParticipantAction}>
                          <input type="hidden" name="applicationId" value={application.id} />
                          <input type="hidden" name="studentId" value={participant.studentId} />
                          <input type="hidden" name="returnView" value="participantes" />
                          <ConfirmSubmitButton
                            message={`Desvincular ${participant.student.name} desta prova?`}
                            className="rounded-md border border-[#efb6bf] px-3 py-2 text-sm font-semibold text-[#b00018] hover:bg-[#fff4f2]"
                          >
                            Desvincular
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
              {application.participants.length === 0 ? (
                <tr>
                  <td className="py-6 pr-4 text-sm text-[#5d6480]" colSpan={5}>
                    Nenhum aluno vinculado a esta prova.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
