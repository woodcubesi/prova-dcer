import Link from "next/link";
import { deleteExamApplicationAction } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { AdminRole } from "@/generated/prisma/client";
import {
  formatAvailabilityWindow,
  formatPurgeDate,
  getApplicationStatus,
  getApplicationStatusLabel,
} from "@/lib/application-availability";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ExamsPageProps = {
  searchParams?: Promise<{
    erro?: string;
    igrejaResponsavel?: string;
    ok?: string;
  }>;
};

export default async function ExamsPage({ searchParams }: ExamsPageProps) {
  const context = await requireAdminContext();
  const params = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;
  const now = new Date();

  const churchOptions = await prisma.church.findMany({
    where: {
      active: true,
      ...(isTeacher ? { id: scopedChurchId || "__missing_church__" } : {}),
    },
    orderBy: { name: "asc" },
  });
  const churchIds = new Set(churchOptions.map((church) => church.id));
  const requestedChurchId = String(params.igrejaResponsavel || "").trim();
  const selectedChurchId =
    scopedChurchId ||
    (requestedChurchId && churchIds.has(requestedChurchId) ? requestedChurchId : "");
  const selectedChurch = churchOptions.find((church) => church.id === selectedChurchId) || null;
  const churchFilter = selectedChurchId
    ? {
        participants: {
          some: {
            student: {
              churchId: selectedChurchId,
            },
          },
        },
      }
    : isTeacher
      ? {
          participants: {
            some: {
              student: {
                churchId: "__missing_church__",
              },
            },
          },
        }
      : {};
  const showingAllChurches = !isTeacher && !selectedChurchId;

  const applications = await prisma.examApplication.findMany({
    where: churchFilter,
    orderBy: { createdAt: "desc" },
    include: {
      exam: true,
      _count: {
        select: {
          attempts: selectedChurchId
            ? {
                where: {
                  student: {
                    churchId: selectedChurchId,
                  },
                },
              }
            : true,
          participants: selectedChurchId
            ? {
                where: {
                  student: {
                    churchId: selectedChurchId,
                  },
                },
              }
            : true,
        },
      },
    },
  });

  return (
    <AdminShell title="Provas" description="Consulte, edite provas ainda nao iniciadas e crie novas aplicacoes.">
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
      {params.ok === "editada" ? (
        <div className="mb-4 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Prova atualizada com sucesso.
        </div>
      ) : null}
      {params.ok === "excluida" ? (
        <div className="mb-4 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Prova excluida com sucesso.
        </div>
      ) : null}

      <section className="mb-5 rounded-lg border border-[#d8def0] bg-white p-4">
        <form action="/admin/provas" className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block">
            <span className="text-sm font-medium">Igreja responsavel</span>
            <select
              name="igrejaResponsavel"
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
          <button className="rounded-md bg-[#000060] px-4 py-3 text-sm font-semibold text-white hover:bg-[#000044]">
            Carregar provas
          </button>
        </form>
        {selectedChurch ? (
          <p className="mt-3 text-sm text-[#5d6480]">
            Exibindo provas vinculadas a <strong>{selectedChurch.name}</strong>.
          </p>
        ) : (
          <p className="mt-3 text-sm text-[#5d6480]">
            {showingAllChurches
              ? "Exibindo provas vinculadas a todas as igrejas."
              : "Selecione uma igreja para listar as provas."}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-[#d8def0] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Provas criadas</h2>
            <p className="text-sm text-[#5d6480]">
              Provas com tentativas iniciadas ficam protegidas contra edicao de conteudo, mas podem ser excluidas.
            </p>
          </div>
          <Link
            href="/admin/provas/nova"
            className="rounded-md bg-[#000060] px-4 py-2 text-center text-sm font-semibold text-white hover:bg-[#000044]"
          >
            Nova prova
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:hidden">
          {applications.map((application) => (
            <div key={application.id} className="rounded-md border border-[#e8ecf8] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{application.exam.title}</p>
                  <p className="mt-1 text-sm text-[#5d6480]">{application.title}</p>
                </div>
                <span className="rounded-full bg-[#effaf2] px-2 py-1 text-xs font-medium text-[#1f623e]">
                  {getApplicationStatusLabel(getApplicationStatus(application, now))}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-[#f8faff] px-3 py-2">
                  <p className="text-xs text-[#5d6480]">Codigo</p>
                  <p className="font-mono font-semibold">{application.accessCode}</p>
                </div>
                <div className="rounded-md bg-[#f8faff] px-3 py-2">
                  <p className="text-xs text-[#5d6480]">Aprovacao</p>
                  <p className="font-semibold">{application.exam.passingPercent ?? 70}%</p>
                </div>
                <div className="rounded-md bg-[#f8faff] px-3 py-2">
                  <p className="text-xs text-[#5d6480]">Participantes</p>
                  <p className="font-semibold">{application._count.participants}</p>
                </div>
                <div className="rounded-md bg-[#f8faff] px-3 py-2">
                  <p className="text-xs text-[#5d6480]">Tentativas</p>
                  <p className="font-semibold">{application._count.attempts}</p>
                </div>
                <div className="rounded-md bg-[#f8faff] px-3 py-2 sm:col-span-2">
                  <p className="text-xs text-[#5d6480]">Disponibilidade</p>
                  <p className="font-semibold">{formatAvailabilityWindow(application)}</p>
                </div>
                <div className="rounded-md bg-[#fff9e6] px-3 py-2 sm:col-span-2">
                  <p className="text-xs text-[#5d6480]">Eliminar do sistema em</p>
                  <p className="font-semibold">{formatPurgeDate(application)}</p>
                </div>
              </div>
              <Link
                href={`/admin/provas/${application.id}/editar`}
                className="mt-3 block rounded-md border border-[#000060] px-3 py-2 text-center text-sm font-semibold text-[#000060]"
              >
                Editar
              </Link>
              <Link
                href={`/admin/provas/${application.id}/relatorio`}
                className="mt-2 block rounded-md bg-[#000060] px-3 py-2 text-center text-sm font-semibold text-white"
              >
                Relatorio PDF
              </Link>
              <form action={deleteExamApplicationAction} className="mt-2">
                <input type="hidden" name="applicationId" value={application.id} />
                <ConfirmSubmitButton
                  message={`Excluir a prova "${application.exam.title}"? Esta acao tambem remove envios e respostas desta aplicacao.`}
                  className="w-full rounded-md border border-[#efb6bf] px-3 py-2 text-center text-sm font-semibold text-[#b00018]"
                >
                  Excluir
                </ConfirmSubmitButton>
              </form>
            </div>
          ))}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1160px] text-left text-sm">
            <thead className="border-b border-[#d8def0] text-xs uppercase tracking-wide text-[#5d6480]">
              <tr>
                <th className="py-3 pr-4">Prova</th>
                <th className="py-3 pr-4">Codigo</th>
                <th className="py-3 pr-4">Tempo</th>
                <th className="py-3 pr-4">Aprovacao</th>
                <th className="py-3 pr-4">Expiracao</th>
                <th className="py-3 pr-4">Eliminacao</th>
                <th className="py-3 pr-4">Participantes</th>
                <th className="py-3 pr-4">Tentativas</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id} className="border-b border-[#e8ecf8] last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{application.exam.title}</p>
                    <p className="text-xs text-[#5d6480]">{application.title}</p>
                  </td>
                  <td className="py-3 pr-4 font-mono">{application.accessCode}</td>
                  <td className="py-3 pr-4">{application.exam.durationMinutes} min</td>
                  <td className="py-3 pr-4">{application.exam.passingPercent ?? 70}%</td>
                  <td className="py-3 pr-4">{formatAvailabilityWindow(application)}</td>
                  <td className="py-3 pr-4">{formatPurgeDate(application)}</td>
                  <td className="py-3 pr-4">{application._count.participants}</td>
                  <td className="py-3 pr-4">{application._count.attempts}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full bg-[#effaf2] px-2 py-1 text-xs font-medium text-[#1f623e]">
                      {getApplicationStatusLabel(getApplicationStatus(application, now))}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/provas/${application.id}/editar`}
                        className="rounded-md border border-[#000060] px-3 py-2 text-sm font-semibold text-[#000060] hover:bg-[#effaf2]"
                      >
                        Editar
                      </Link>
                      <Link
                        href={`/admin/provas/${application.id}/relatorio`}
                        className="rounded-md bg-[#000060] px-3 py-2 text-sm font-semibold text-white hover:bg-[#000044]"
                      >
                        Relatorio PDF
                      </Link>
                      <form action={deleteExamApplicationAction}>
                        <input type="hidden" name="applicationId" value={application.id} />
                        <ConfirmSubmitButton
                          message={`Excluir a prova "${application.exam.title}"? Esta acao tambem remove envios e respostas desta aplicacao.`}
                          className="rounded-md border border-[#efb6bf] px-3 py-2 text-sm font-semibold text-[#b00018] hover:bg-[#fff4f2]"
                        >
                          Excluir
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {applications.length === 0 ? (
                <tr>
                  <td className="py-6 pr-4 text-sm text-[#5d6480]" colSpan={10}>
                    Nenhuma prova criada ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {applications.length === 0 ? (
          <div className="mt-4 rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-4 text-sm text-[#5d6480] md:hidden">
            Nenhuma prova criada ainda.
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
