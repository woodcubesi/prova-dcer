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
    embaixador?: string;
    erro?: string;
    igreja?: string;
    ok?: string;
  }>;
};

function formatDateInput(date?: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function formatDateLabel(date?: Date | null) {
  return date ? date.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-";
}

export default async function RegistersPage({ searchParams }: RegisterPageProps) {
  const context = await requireAdminContext();
  const params = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;
  const churchFilter = {
    active: true,
    ...(isTeacher ? { id: scopedChurchId || "__missing_church__" } : {}),
  };

  const [churches, students] = await Promise.all([
    prisma.church.findMany({
      where: churchFilter,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { students: true },
        },
      },
    }),
    prisma.student.findMany({
      where: {
        active: true,
        ...(isTeacher ? { churchId: scopedChurchId || "__missing_church__" } : {}),
      },
      orderBy: [{ church: { name: "asc" } }, { category: "asc" }, { name: "asc" }],
      include: {
        church: true,
      },
    }),
  ]);

  const editingChurch =
    !isTeacher && params.igreja ? churches.find((church) => church.id === params.igreja) || null : null;
  const editingStudent = params.embaixador
    ? students.find((student) => student.id === params.embaixador) || null
    : null;

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
                  href="/admin/cadastros"
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
                  <p>{churches[0]?.name || "Igreja nao vinculada"}</p>
                  {churches[0]?.embassyName ? (
                    <p className="mt-1 text-xs text-[#5d6480]">Embaixada: {churches[0].embassyName}</p>
                  ) : null}
                </div>
              </label>
            ) : (
              <label className="block">
                <span className="text-sm font-medium">Igreja</span>
                <select
                  name="churchId"
                  defaultValue={editingStudent?.churchId || ""}
                  className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
                >
                  <option value="">Selecione</option>
                  {churches.map((church) => (
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
                href="/admin/cadastros"
                className="rounded-md border border-[#d8def0] px-4 py-3 text-center text-sm font-semibold text-[#000060] hover:bg-[#f7f8ff]"
              >
                Cancelar
              </a>
            ) : null}
          </div>
        </form>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-[#d8def0] bg-white p-4">
          <h2 className="text-lg font-semibold">Igrejas cadastradas</h2>
          <div className="mt-3 space-y-2">
            {churches.map((church) => (
              <div key={church.id} className="rounded-md border border-[#e8ecf8] px-3 py-2">
                <p className="font-medium">{church.name}</p>
                <p className="text-sm text-[#111827]">{church.embassyName || "Embaixada nao informada"}</p>
                <p className="text-xs text-[#5d6480]">
                  {church._count.students} embaixador(es) {church.city ? `- ${church.city}` : ""}
                </p>
                {!isTeacher ? (
                  <a
                    href={`/admin/cadastros?igreja=${church.id}`}
                    className="mt-2 inline-flex rounded-md border border-[#000060] px-3 py-2 text-sm font-semibold text-[#000060]"
                  >
                    Editar
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#d8def0] bg-white p-4">
          <h2 className="text-lg font-semibold">Embaixadores cadastrados</h2>
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
                      {student.hasMedicalReport ? `${student.extraTimePercent ?? 0}% extra` : "-"}
                    </p>
                  </div>
                </div>
                <span className="mt-2 inline-flex rounded-full bg-[#effaf2] px-2 py-1 text-xs font-medium text-[#1f623e]">
                  {getCategoryLabel(student.category)}
                </span>
                <a
                  href={`/admin/cadastros?embaixador=${student.id}`}
                  className="mt-3 block rounded-md border border-[#000060] px-3 py-2 text-center text-sm font-semibold text-[#000060]"
                >
                  Editar
                </a>
              </div>
            ))}
          </div>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] text-left text-sm">
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
                      {student.hasMedicalReport ? `${student.extraTimePercent ?? 0}% extra` : "-"}
                    </td>
                    <td className="py-3 pr-4">
                      <a
                        href={`/admin/cadastros?embaixador=${student.id}`}
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
                      Nenhum embaixador cadastrado ainda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {students.length === 0 ? (
            <div className="mt-3 rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-4 text-sm text-[#5d6480] md:hidden">
              Nenhum embaixador cadastrado ainda.
            </div>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
