import {
  createChurchAction,
  createStudentAction,
  updateChurchAction,
  updateStudentAction,
} from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminRole } from "@/generated/prisma/client";
import { CATEGORIES, getCategoryLabel } from "@/lib/categories";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RegisterPageProps = {
  searchParams?: Promise<{
    alunosPagina?: string;
    alunosPorPagina?: string;
    embaixador?: string;
    embaixadorSelecionado?: string;
    erro?: string;
    igreja?: string;
    igrejaResponsavel?: string;
    ok?: string;
    provasPagina?: string;
    provasPorPagina?: string;
  }>;
};

const pageSizeOptions = [5, 10, 50, 100] as const;
const defaultPageSize = 10;

function formatDateInput(date?: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function formatDateLabel(date?: Date | null) {
  return date ? date.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-";
}

function parsePositiveInt(value?: string) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value?: string) {
  const parsed = Number.parseInt(value || "", 10);
  return pageSizeOptions.includes(parsed as (typeof pageSizeOptions)[number]) ? parsed : defaultPageSize;
}

function clampPage(page: number, totalItems: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return Math.min(Math.max(1, page), totalPages);
}

function formatPageRange(page: number, pageSize: number, shownItems: number, totalItems: number) {
  if (totalItems === 0) return "0 de 0";

  const start = (page - 1) * pageSize + 1;
  const end = start + shownItems - 1;
  return `${start}-${end} de ${totalItems}`;
}

function buildRegistersHref(
  params: Awaited<NonNullable<RegisterPageProps["searchParams"]>>,
  overrides: Record<string, string | number | null | undefined>,
) {
  const nextParams = new URLSearchParams();
  const keys = [
    "igrejaResponsavel",
    "embaixadorSelecionado",
    "alunosPagina",
    "alunosPorPagina",
    "provasPagina",
    "provasPorPagina",
  ] as const;

  keys.forEach((key) => {
    const value = overrides[key] ?? params[key];

    if (value !== undefined && value !== null && String(value) !== "") {
      nextParams.set(key, String(value));
    }
  });

  const query = nextParams.toString();
  return query ? `/admin/cadastros?${query}` : "/admin/cadastros";
}

export default async function RegistersPage({ searchParams }: RegisterPageProps) {
  const context = await requireAdminContext();
  const params = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;

  const churchOptions = await prisma.church.findMany({
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

  const [editingChurch, editingStudent] = await Promise.all([
    !isTeacher && params.igreja
      ? prisma.church.findFirst({
          where: {
            id: params.igreja,
            active: true,
          },
          include: {
            _count: {
              select: { students: true },
            },
          },
        })
      : null,
    params.embaixador
      ? prisma.student.findFirst({
          where: {
            id: params.embaixador,
            active: true,
            ...(isTeacher ? { churchId: scopedChurchId || "__missing_church__" } : {}),
          },
          include: {
            church: true,
          },
        })
      : null,
  ]);

  const churchIds = new Set(churchOptions.map((church) => church.id));
  const requestedChurchId = String(params.igrejaResponsavel || "").trim();
  const selectedChurchId =
    scopedChurchId ||
    (requestedChurchId && churchIds.has(requestedChurchId)
      ? requestedChurchId
      : editingStudent?.churchId || editingChurch?.id || "");
  const selectedChurch = churchOptions.find((church) => church.id === selectedChurchId) || null;
  const requestedStudentId = String(params.embaixadorSelecionado || "").trim();
  const canListAllChurches = !isTeacher;
  const studentPageSize = parsePageSize(params.alunosPorPagina);
  const requestedStudentPage = parsePositiveInt(params.alunosPagina);
  const applicationPageSize = parsePageSize(params.provasPorPagina);
  const requestedApplicationPage = parsePositiveInt(params.provasPagina);
  const studentBaseFilter = selectedChurchId
    ? {
        active: true,
        churchId: selectedChurchId,
      }
    : canListAllChurches
      ? {
          active: true,
          church: {
            active: true,
          },
        }
      : {
          active: true,
          id: "__missing_student__",
        };
  const applicationFilter = selectedChurchId
    ? {
        participants: {
          some: {
            student: {
              churchId: selectedChurchId,
            },
          },
        },
      }
    : canListAllChurches
      ? {
          participants: {
            some: {
              student: {
                church: {
                  active: true,
                },
              },
            },
          },
        }
      : {
          id: "__missing_application__",
        };

  const [studentOptions, totalStudents, totalApplications] = await Promise.all([
    prisma.student.findMany({
      where: selectedChurchId
        ? {
            active: true,
            churchId: selectedChurchId,
          }
        : {
            id: "__missing_student__",
          },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        externalId: true,
      },
    }),
    prisma.student.count({
      where: studentBaseFilter,
    }),
    prisma.examApplication.count({
      where: applicationFilter,
    }),
  ]);
  const studentOptionIds = new Set(studentOptions.map((student) => student.id));
  const selectedStudentId = requestedStudentId && studentOptionIds.has(requestedStudentId) ? requestedStudentId : "";
  const studentFilter = {
    ...studentBaseFilter,
    ...(selectedStudentId ? { id: selectedStudentId } : {}),
  };
  const filteredTotalStudents = selectedStudentId ? 1 : totalStudents;
  const studentPage = clampPage(requestedStudentPage, filteredTotalStudents, studentPageSize);
  const studentSkip = (studentPage - 1) * studentPageSize;
  const applicationPage = clampPage(requestedApplicationPage, totalApplications, applicationPageSize);
  const applicationSkip = (applicationPage - 1) * applicationPageSize;

  const [students, applications] = await Promise.all([
    prisma.student.findMany({
      where: studentFilter,
      orderBy: [{ church: { name: "asc" } }, { category: "asc" }, { name: "asc" }],
      skip: studentSkip,
      take: studentPageSize,
      include: {
        church: true,
      },
    }),
    prisma.examApplication.findMany({
      where: applicationFilter,
      orderBy: { createdAt: "desc" },
      skip: applicationSkip,
      take: applicationPageSize,
      include: {
        exam: {
          select: {
            title: true,
            durationMinutes: true,
            passingPercent: true,
          },
        },
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
    }),
  ]);
  const totalStudentPages = Math.max(1, Math.ceil(filteredTotalStudents / studentPageSize));
  const totalApplicationPages = Math.max(1, Math.ceil(totalApplications / applicationPageSize));

  const selectedChurchLabel = selectedChurch
    ? selectedChurch.embassyName
      ? `${selectedChurch.name} - ${selectedChurch.embassyName}`
      : selectedChurch.name
    : "";

  return (
    <AdminShell title="Cadastros" description="Pre-cadastre igrejas e embaixadores antes de liberar uma prova.">
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
      {params.ok ? (
        <div className="mb-4 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Cadastro salvo.
        </div>
      ) : null}
      {params.igreja && !editingChurch && !isTeacher ? (
        <div className="mb-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-4 py-3 text-sm text-[#b00018]">
          Igreja nao encontrada para edicao.
        </div>
      ) : null}
      {params.embaixador && !editingStudent ? (
        <div className="mb-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-4 py-3 text-sm text-[#b00018]">
          Embaixador nao encontrado para edicao.
        </div>
      ) : null}

      <section className="mb-5 rounded-lg border border-[#d8def0] bg-white p-4">
        <form action="/admin/cadastros" className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <input type="hidden" name="alunosPorPagina" value={studentPageSize} />
          <input type="hidden" name="provasPorPagina" value={applicationPageSize} />
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
            Carregar listas
          </button>
        </form>
        {selectedChurch ? (
          <p className="mt-3 text-sm text-[#5d6480]">
            Exibindo embaixadores e provas vinculados a <strong>{selectedChurchLabel}</strong>.
          </p>
        ) : !isTeacher && churchOptions.length > 0 ? (
          <p className="mt-3 text-sm text-[#5d6480]">
            Exibindo alunos e provas de todas as igrejas ativas com paginacao.
          </p>
        ) : (
          <p className="mt-3 text-sm text-[#5d6480]">Selecione uma igreja para carregar os cadastros.</p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {!isTeacher ? (
          <form
            action={editingChurch ? updateChurchAction : createChurchAction}
            className="rounded-lg border border-[#d8def0] bg-white p-4"
          >
            {editingChurch ? <input type="hidden" name="id" value={editingChurch.id} /> : null}
            <h2 className="text-lg font-semibold">{editingChurch ? "Editar igreja" : "Nova igreja"}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium">Nome da igreja</span>
                <input
                  name="name"
                  defaultValue={editingChurch?.name || ""}
                  className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
                  placeholder="Ex.: Batista em Vila Iorio"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium">Nome da embaixada</span>
                <input
                  name="embassyName"
                  defaultValue={editingChurch?.embassyName || ""}
                  className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
                  placeholder="Ex.: Pastor Sergio Medeiros"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium">Cidade/bairro opcional</span>
                <input
                  name="city"
                  defaultValue={editingChurch?.city || ""}
                  className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
                  placeholder="Ex.: Paulista"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button className="rounded-md bg-[#000060] px-4 py-3 text-sm font-semibold text-white hover:bg-[#000044]">
                {editingChurch ? "Atualizar igreja" : "Salvar igreja"}
              </button>
              {editingChurch ? (
                <a
                  href={`/admin/cadastros?igrejaResponsavel=${editingChurch.id}`}
                  className="rounded-md border border-[#d8def0] px-4 py-3 text-center text-sm font-semibold text-[#000060] hover:bg-[#f7f8ff]"
                >
                  Cancelar
                </a>
              ) : null}
            </div>
          </form>
        ) : null}

        <form
          action={editingStudent ? updateStudentAction : createStudentAction}
          className="rounded-lg border border-[#d8def0] bg-white p-4"
        >
          {editingStudent ? <input type="hidden" name="id" value={editingStudent.id} /> : null}
          <h2 className="text-lg font-semibold">{editingStudent ? "Editar embaixador" : "Novo embaixador"}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {isTeacher ? (
              <label className="block">
                <span className="text-sm font-medium">Igreja</span>
                <input type="hidden" name="churchId" value={scopedChurchId || ""} />
                <div className="mt-1 rounded-md border border-[#c5cce4] bg-[#f8faff] px-3 py-3 text-sm">
                  <p>{selectedChurch?.name || "Igreja nao vinculada"}</p>
                  {selectedChurch?.embassyName ? (
                    <p className="mt-1 text-xs text-[#5d6480]">Embaixada: {selectedChurch.embassyName}</p>
                  ) : null}
                </div>
              </label>
            ) : (
              <label className="block">
                <span className="text-sm font-medium">Igreja</span>
                <select
                  name="churchId"
                  defaultValue={editingStudent?.churchId || selectedChurchId || ""}
                  className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
                >
                  <option value="">Selecione</option>
                  {churchOptions.map((church) => (
                    <option key={church.id} value={church.id}>
                      {church.embassyName ? `${church.name} - ${church.embassyName}` : church.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="text-sm font-medium">Categoria</span>
              <select
                name="category"
                defaultValue={editingStudent?.category || ""}
                className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              >
                <option value="">Selecione</option>
                {CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Nome do embaixador</span>
              <input
                name="name"
                defaultValue={editingStudent?.name || ""}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
                placeholder="Nome completo"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Numero da inscricao</span>
              <input
                name="externalId"
                defaultValue={editingStudent?.externalId || ""}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
                placeholder="Ex.: 210300100049"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Emissao</span>
              <input
                name="registrationIssuedAt"
                type="date"
                defaultValue={formatDateInput(editingStudent?.registrationIssuedAt)}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Validade</span>
              <input
                name="registrationExpiresAt"
                type="date"
                defaultValue={formatDateInput(editingStudent?.registrationExpiresAt)}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Nascimento</span>
              <input
                name="birthDate"
                type="date"
                defaultValue={formatDateInput(editingStudent?.birthDate)}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Admissao na embaixada</span>
              <input
                name="embassyAdmissionDate"
                type="date"
                defaultValue={formatDateInput(editingStudent?.embassyAdmissionDate)}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              />
            </label>
            <div className="rounded-md border border-[#d8def0] bg-[#f8faff] p-3 sm:col-span-2">
              <label className="flex items-start gap-3">
                <input
                  name="hasMedicalReport"
                  type="checkbox"
                  defaultChecked={editingStudent?.hasMedicalReport || false}
                  className="mt-1 h-4 w-4 rounded border-[#c5cce4] accent-[#000060]"
                />
                <span>
                  <span className="block text-sm font-medium">Possui laudo</span>
                  <span className="mt-1 block text-xs leading-5 text-[#5d6480]">
                    Ao marcar esta opcao, informe o percentual de tempo adicional de 0 a 100%.
                  </span>
                </span>
              </label>
              <label className="mt-3 block">
                <span className="text-sm font-medium">Tempo adicional do laudo (%)</span>
                <input
                  name="extraTimePercent"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  defaultValue={editingStudent?.extraTimePercent ?? ""}
                  className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
                  placeholder="Ex.: 10"
                />
              </label>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button className="rounded-md bg-[#000060] px-4 py-3 text-sm font-semibold text-white hover:bg-[#000044]">
              {editingStudent ? "Atualizar embaixador" : "Salvar embaixador"}
            </button>
            {editingStudent ? (
              <a
                href={`/admin/cadastros?igrejaResponsavel=${editingStudent.churchId}`}
                className="rounded-md border border-[#d8def0] px-4 py-3 text-center text-sm font-semibold text-[#000060] hover:bg-[#f7f8ff]"
              >
                Cancelar
              </a>
            ) : null}
          </div>
        </form>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-[#d8def0] bg-white p-4">
            <h2 className="text-lg font-semibold">Igreja selecionada</h2>
            {selectedChurch ? (
              <div className="mt-3 rounded-md border border-[#e8ecf8] px-3 py-3">
                <p className="font-medium">{selectedChurch.name}</p>
                <p className="text-sm text-[#111827]">{selectedChurch.embassyName || "Embaixada nao informada"}</p>
                <p className="text-xs text-[#5d6480]">
                  {selectedChurch._count.students} embaixador(es) {selectedChurch.city ? `- ${selectedChurch.city}` : ""}
                </p>
                {!isTeacher ? (
                  <a
                    href={`/admin/cadastros?igreja=${selectedChurch.id}&igrejaResponsavel=${selectedChurch.id}`}
                    className="mt-3 inline-flex rounded-md border border-[#000060] px-3 py-2 text-sm font-semibold text-[#000060]"
                  >
                    Editar igreja
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-4 text-sm text-[#5d6480]">
                {churchOptions.length > 0
                  ? `${churchOptions.length} igreja(s) ativa(s). Abaixo estao todos os alunos e provas paginados.`
                  : "Nenhuma igreja cadastrada."}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[#d8def0] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{selectedChurchId ? "Provas da igreja" : "Todas as provas"}</h2>
                <p className="text-sm text-[#5d6480]">
                  Mostrando {formatPageRange(applicationPage, applicationPageSize, applications.length, totalApplications)}.
                </p>
              </div>
              <a
                href={selectedChurchId ? `/admin/provas?igrejaResponsavel=${selectedChurchId}` : "/admin/provas"}
                className="rounded-md border border-[#000060] px-3 py-2 text-sm font-semibold text-[#000060]"
              >
                Ver todas
              </a>
            </div>
            <form action="/admin/cadastros" className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="igrejaResponsavel" value={selectedChurchId} />
              <input type="hidden" name="embaixadorSelecionado" value={selectedStudentId} />
              <input type="hidden" name="alunosPagina" value={studentPage} />
              <input type="hidden" name="alunosPorPagina" value={studentPageSize} />
              <input type="hidden" name="provasPagina" value="1" />
              <label className="block">
                <span className="text-xs font-medium text-[#5d6480]">Provas por pagina</span>
                <select
                  name="provasPorPagina"
                  defaultValue={applicationPageSize}
                  className="mt-1 rounded-md border border-[#c5cce4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#000060]"
                >
                  {pageSizeOptions.map((pageSize) => (
                    <option key={pageSize} value={pageSize}>
                      {pageSize}
                    </option>
                  ))}
                </select>
              </label>
              <button className="rounded-md border border-[#000060] px-3 py-2 text-sm font-semibold text-[#000060]">
                Atualizar
              </button>
            </form>
            <div className="mt-3 space-y-2">
              {applications.map((application) => (
                <div key={application.id} className="rounded-md border border-[#e8ecf8] px-3 py-2">
                  <p className="font-medium">{application.exam.title}</p>
                  <p className="text-sm text-[#5d6480]">{application.title}</p>
                  <p className="mt-1 text-xs text-[#5d6480]">
                    {application._count.participants} participante(s) - {application._count.attempts} tentativa(s)
                  </p>
                  <a
                    href={`/admin/provas/${application.id}/editar`}
                    className="mt-2 inline-flex rounded-md border border-[#000060] px-3 py-2 text-sm font-semibold text-[#000060]"
                  >
                    Editar prova
                  </a>
                </div>
              ))}
              {applications.length === 0 ? (
                <div className="rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-4 text-sm text-[#5d6480]">
                  {selectedChurchId
                    ? "Nenhuma prova cadastrada para esta igreja."
                    : "Nenhuma prova cadastrada para as igrejas ativas."}
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              {applicationPage > 1 ? (
                <a
                  href={buildRegistersHref(params, { provasPagina: applicationPage - 1 })}
                  className="rounded-md border border-[#d8def0] px-3 py-2 font-semibold text-[#000060]"
                >
                  Anterior
                </a>
              ) : (
                <span className="rounded-md border border-[#e8ecf8] px-3 py-2 text-[#9ca3af]">Anterior</span>
              )}
              <span className="text-[#5d6480]">
                Pagina {applicationPage} de {totalApplicationPages}
              </span>
              {applicationPage < totalApplicationPages ? (
                <a
                  href={buildRegistersHref(params, { provasPagina: applicationPage + 1 })}
                  className="rounded-md border border-[#d8def0] px-3 py-2 font-semibold text-[#000060]"
                >
                  Proxima
                </a>
              ) : (
                <span className="rounded-md border border-[#e8ecf8] px-3 py-2 text-[#9ca3af]">Proxima</span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#d8def0] bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {selectedChurchId ? "Embaixadores da igreja" : "Todos os embaixadores"}
              </h2>
              <p className="text-sm text-[#5d6480]">
                Mostrando {formatPageRange(studentPage, studentPageSize, students.length, filteredTotalStudents)}.
              </p>
            </div>
            <form
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:min-w-[680px]"
              action="/admin/cadastros"
            >
              <input type="hidden" name="igrejaResponsavel" value={selectedChurchId} />
              <input type="hidden" name="alunosPagina" value="1" />
              <input type="hidden" name="provasPagina" value={applicationPage} />
              <input type="hidden" name="provasPorPagina" value={applicationPageSize} />
              <select
                name="embaixadorSelecionado"
                defaultValue={selectedStudentId}
                disabled={!selectedChurchId}
                className="min-w-0 rounded-md border border-[#c5cce4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f3f4f6] disabled:text-[#6b7280]"
              >
                <option value="">
                  {selectedChurchId ? "Todos os embaixadores da igreja" : "Todas as igrejas selecionadas"}
                </option>
                {studentOptions.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.externalId
                      ? `${student.name} - ${student.externalId} - ${getCategoryLabel(student.category)}`
                      : `${student.name} - ${getCategoryLabel(student.category)}`}
                  </option>
                ))}
              </select>
              <select
                name="alunosPorPagina"
                defaultValue={studentPageSize}
                className="rounded-md border border-[#c5cce4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#000060]"
              >
                {pageSizeOptions.map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize} por pagina
                  </option>
                ))}
              </select>
              <button className="rounded-md border border-[#000060] px-3 py-2 text-sm font-semibold text-[#000060]">
                Carregar lista
              </button>
              {selectedChurchId ? (
                <a
                  href={buildRegistersHref(params, {
                    igrejaResponsavel: selectedChurchId,
                    embaixadorSelecionado: "",
                    alunosPagina: 1,
                    alunosPorPagina: studentPageSize,
                  })}
                  className="rounded-md border border-[#000060] px-3 py-2 text-center text-sm font-semibold text-[#000060] hover:bg-[#f7f8ff]"
                >
                  Ver todos alunos
                </a>
              ) : null}
            </form>
          </div>
          <div className="mt-3 grid gap-3 md:hidden">
            {students.map((student) => (
              <div key={student.id} className="rounded-md border border-[#e8ecf8] p-3">
                <p className="font-medium">{student.name}</p>
                <p className="mt-1 text-sm text-[#5d6480]">
                  {student.church.embassyName || "Embaixada nao informada"} - {student.church.name}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-[#f8faff] px-2 py-2">
                    <p className="text-[#5d6480]">Inscricao</p>
                    <p className="font-semibold">{student.externalId || "-"}</p>
                  </div>
                  <div className="rounded-md bg-[#f8faff] px-2 py-2">
                    <p className="text-[#5d6480]">Validade</p>
                    <p className="font-semibold">{formatDateLabel(student.registrationExpiresAt)}</p>
                  </div>
                  <div className="rounded-md bg-[#f8faff] px-2 py-2">
                    <p className="text-[#5d6480]">Nascimento</p>
                    <p className="font-semibold">{formatDateLabel(student.birthDate)}</p>
                  </div>
                  <div className="rounded-md bg-[#f8faff] px-2 py-2">
                    <p className="text-[#5d6480]">Admissao</p>
                    <p className="font-semibold">{formatDateLabel(student.embassyAdmissionDate)}</p>
                  </div>
                  <div className="rounded-md bg-[#f8faff] px-2 py-2">
                    <p className="text-[#5d6480]">Laudo</p>
                    <p className="font-semibold">
                      {student.hasMedicalReport ? `Sim, ${student.extraTimePercent ?? 0}% extra` : "Nao"}
                    </p>
                  </div>
                </div>
                <span className="mt-2 inline-flex rounded-full bg-[#effaf2] px-2 py-1 text-xs font-medium text-[#1f623e]">
                  {getCategoryLabel(student.category)}
                </span>
                <a
                  href={`/admin/cadastros?embaixador=${student.id}&igrejaResponsavel=${selectedChurchId}&embaixadorSelecionado=${student.id}`}
                  className="mt-3 block rounded-md border border-[#000060] px-3 py-2 text-center text-sm font-semibold text-[#000060]"
                >
                  Editar
                </a>
              </div>
            ))}
          </div>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1060px] text-left text-sm">
              <thead className="border-b border-[#d8def0] text-xs uppercase tracking-wide text-[#5d6480]">
                <tr>
                  <th className="py-3 pr-4">Nome</th>
                  <th className="py-3 pr-4">Inscricao</th>
                  <th className="py-3 pr-4">Embaixada</th>
                  <th className="py-3 pr-4">Igreja</th>
                  <th className="py-3 pr-4">Categoria</th>
                  <th className="py-3 pr-4">Nascimento</th>
                  <th className="py-3 pr-4">Validade</th>
                  <th className="py-3 pr-4">Laudo</th>
                  <th className="py-3 pr-4">Acao</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-[#e8ecf8] last:border-0">
                    <td className="py-3 pr-4 font-medium">{student.name}</td>
                    <td className="py-3 pr-4 font-mono">{student.externalId || "-"}</td>
                    <td className="py-3 pr-4">{student.church.embassyName || "-"}</td>
                    <td className="py-3 pr-4">{student.church.name}</td>
                    <td className="py-3 pr-4">{getCategoryLabel(student.category)}</td>
                    <td className="py-3 pr-4">{formatDateLabel(student.birthDate)}</td>
                    <td className="py-3 pr-4">{formatDateLabel(student.registrationExpiresAt)}</td>
                    <td className="py-3 pr-4">
                      {student.hasMedicalReport ? `Sim, ${student.extraTimePercent ?? 0}% extra` : "Nao"}
                    </td>
                    <td className="py-3 pr-4">
                      <a
                        href={`/admin/cadastros?embaixador=${student.id}&igrejaResponsavel=${selectedChurchId}&embaixadorSelecionado=${student.id}`}
                        className="rounded-md border border-[#000060] px-3 py-2 text-sm font-semibold text-[#000060] hover:bg-[#effaf2]"
                      >
                        Editar
                      </a>
                    </td>
                  </tr>
                ))}
                {students.length === 0 ? (
                  <tr>
                    <td className="py-6 pr-4 text-sm text-[#5d6480]" colSpan={9}>
                      {selectedChurchId
                        ? "Nenhum embaixador encontrado para esta selecao."
                        : "Nenhum embaixador cadastrado para as igrejas ativas."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {students.length === 0 ? (
            <div className="mt-3 rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-4 text-sm text-[#5d6480] md:hidden">
              {selectedChurchId
                ? "Nenhum embaixador encontrado para esta selecao."
                : "Nenhum embaixador cadastrado para as igrejas ativas."}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            {studentPage > 1 ? (
              <a
                href={buildRegistersHref(params, { alunosPagina: studentPage - 1 })}
                className="rounded-md border border-[#d8def0] px-3 py-2 font-semibold text-[#000060]"
              >
                Anterior
              </a>
            ) : (
              <span className="rounded-md border border-[#e8ecf8] px-3 py-2 text-[#9ca3af]">Anterior</span>
            )}
            <span className="text-[#5d6480]">
              Pagina {studentPage} de {totalStudentPages}
            </span>
            {studentPage < totalStudentPages ? (
              <a
                href={buildRegistersHref(params, { alunosPagina: studentPage + 1 })}
                className="rounded-md border border-[#d8def0] px-3 py-2 font-semibold text-[#000060]"
              >
                Proxima
              </a>
            ) : (
              <span className="rounded-md border border-[#e8ecf8] px-3 py-2 text-[#9ca3af]">Proxima</span>
            )}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
