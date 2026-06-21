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
                  placeholder="Ex.: Igreja Sede Central"
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
                  {churches[0]?.name || "Igreja nao vinculada"}
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
                      {church.name}
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
                <p className="mt-1 text-sm text-[#5d6480]">{student.church.name}</p>
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
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[#d8def0] text-xs uppercase tracking-wide text-[#5d6480]">
                <tr>
                  <th className="py-3 pr-4">Nome</th>
                  <th className="py-3 pr-4">Igreja</th>
                  <th className="py-3 pr-4">Categoria</th>
                  <th className="py-3 pr-4">Acao</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-[#e8ecf8] last:border-0">
                    <td className="py-3 pr-4 font-medium">{student.name}</td>
                    <td className="py-3 pr-4">{student.church.name}</td>
                    <td className="py-3 pr-4">{getCategoryLabel(student.category)}</td>
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
                    <td className="py-6 pr-4 text-sm text-[#5d6480]" colSpan={4}>
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
