import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminRole } from "@/generated/prisma/client";
import { getCategoryLabel } from "@/lib/categories";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function CorrectionPage() {
  const context = await requireAdminContext();
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;

  const attempts = await prisma.attempt.findMany({
    where: {
      status: { in: ["SUBMITTED", "EXPIRED"] },
      ...(isTeacher
        ? {
            student: {
              churchId: scopedChurchId || "__missing_church__",
            },
          }
        : {}),
    },
    orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
    include: {
      student: {
        include: {
          church: true,
        },
      },
      application: {
        include: {
          exam: true,
        },
      },
      answers: true,
    },
  });

  return (
    <AdminShell title="Correcao" description="Confira respostas enviadas e a pontuacao automatica.">
      {isTeacher && !scopedChurchId ? (
        <div className="mb-4 rounded-md border border-[#efc2bd] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b2d20]">
          Seu usuario de professor ainda nao esta vinculado a uma igreja.
        </div>
      ) : null}

      <section className="rounded-lg border border-[#dfe6dd] bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Provas recebidas</h2>
            <p className="text-sm text-[#66736a]">O aluno nao visualiza nota ao final.</p>
          </div>
          <span className="rounded-full bg-[#effaf2] px-3 py-1 text-sm font-semibold text-[#1f623e]">
            {attempts.length} envio(s)
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:hidden">
          {attempts.map((attempt) => (
            <div key={attempt.id} className="rounded-md border border-[#edf1eb] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{attempt.student.name}</p>
                  <p className="mt-1 text-sm text-[#66736a]">
                    {attempt.student.church.name} - {getCategoryLabel(attempt.student.category)}
                  </p>
                </div>
                <span className="rounded-full bg-[#effaf2] px-2 py-1 text-xs font-medium text-[#1f623e]">
                  {attempt.status === "SUBMITTED" ? "Enviada" : "Expirada"}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium">{attempt.application.exam.title}</p>
              <p className="text-xs text-[#66736a]">{attempt.application.title}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-[#f7faf6] px-3 py-2">
                  <p className="text-xs text-[#66736a]">Tempo usado</p>
                  <p className="font-semibold">
                    {attempt.timeUsedSeconds ? formatDuration(attempt.timeUsedSeconds) : "-"}
                  </p>
                </div>
                <div className="rounded-md bg-[#f7faf6] px-3 py-2">
                  <p className="text-xs text-[#66736a]">Pontuacao</p>
                  <p className="font-semibold">
                    {attempt.score === null || attempt.score === undefined
                      ? "Pendente"
                      : `${attempt.score} / ${attempt.totalPoints ?? "-"}`}
                  </p>
                </div>
              </div>
              <Link
                href={`/admin/correcao/${attempt.id}`}
                className="mt-3 block rounded-md border border-[#2c6d49] px-3 py-2 text-center text-sm font-semibold text-[#2c6d49]"
              >
                Abrir
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-[#dfe6dd] text-xs uppercase tracking-wide text-[#66736a]">
              <tr>
                <th className="py-3 pr-4">Aluno</th>
                <th className="py-3 pr-4">Prova</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Tempo usado</th>
                <th className="py-3 pr-4">Pontuacao</th>
                <th className="py-3 pr-4">Acao</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => (
                <tr key={attempt.id} className="border-b border-[#edf1eb] last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{attempt.student.name}</p>
                    <p className="text-xs text-[#66736a]">
                      {attempt.student.church.name} - {getCategoryLabel(attempt.student.category)}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <p>{attempt.application.exam.title}</p>
                    <p className="text-xs text-[#66736a]">{attempt.application.title}</p>
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
                      : `${attempt.score} / ${attempt.totalPoints ?? "-"}`}
                  </td>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/correcao/${attempt.id}`}
                      className="rounded-md border border-[#2c6d49] px-3 py-2 text-sm font-semibold text-[#2c6d49] hover:bg-[#effaf2]"
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {attempts.length === 0 ? (
          <div className="mt-4 rounded-md border border-[#edf1eb] bg-[#fbfcfa] p-4 text-sm text-[#66736a]">
            Ainda nao ha provas enviadas.
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
