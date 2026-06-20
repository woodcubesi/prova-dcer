import { createChurchAction, createStudentAction } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminRole } from "@/generated/prisma/client";
import { CATEGORIES, getCategoryLabel } from "@/lib/categories";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RegisterPageProps = {
  searchParams?: Promise<{
    erro?: string;
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

  return (
    <AdminShell title="Cadastros" description="Pre-cadastre igrejas e alunos antes de liberar uma prova.">
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
      {params.ok ? (
        <div className="mb-4 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Cadastro salvo.
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {!isTeacher ? (
          <form action={createChurchAction} className="rounded-lg border border-[#dfe6dd] bg-white p-4">
            <h2 className="text-lg font-semibold">Nova igreja</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium">Nome da igreja</span>
                <input
                  name="name"
                  className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
                  placeholder="Ex.: Igreja Sede Central"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium">Cidade/bairro opcional</span>
                <input
                  name="city"
                  className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
                  placeholder="Ex.: Paulista"
                />
              </label>
            </div>
            <button className="mt-4 rounded-md bg-[#12382a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1c513d]">
              Salvar igreja
            </button>
          </form>
        ) : null}

        <form action={createStudentAction} className="rounded-lg border border-[#dfe6dd] bg-white p-4">
          <h2 className="text-lg font-semibold">Novo aluno</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {isTeacher ? (
              <label className="block">
                <span className="text-sm font-medium">Igreja</span>
                <input type="hidden" name="churchId" value={scopedChurchId || ""} />
                <div className="mt-1 rounded-md border border-[#cdd8cf] bg-[#f7faf6] px-3 py-3 text-sm">
                  {churches[0]?.name || "Igreja nao vinculada"}
                </div>
              </label>
            ) : (
              <label className="block">
                <span className="text-sm font-medium">Igreja</span>
                <select
                  name="churchId"
                  className="mt-1 w-full rounded-md border border-[#cdd8cf] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
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
                className="mt-1 w-full rounded-md border border-[#cdd8cf] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
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
              <span className="text-sm font-medium">Nome do aluno</span>
              <input
                name="name"
                className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
                placeholder="Nome completo"
              />
            </label>
          </div>
          <button className="mt-4 rounded-md bg-[#12382a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1c513d]">
            Salvar aluno
          </button>
        </form>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-[#dfe6dd] bg-white p-4">
          <h2 className="text-lg font-semibold">Igrejas cadastradas</h2>
          <div className="mt-3 space-y-2">
            {churches.map((church) => (
              <div key={church.id} className="rounded-md border border-[#edf1eb] px-3 py-2">
                <p className="font-medium">{church.name}</p>
                <p className="text-xs text-[#66736a]">
                  {church._count.students} aluno(s) {church.city ? `- ${church.city}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#dfe6dd] bg-white p-4">
          <h2 className="text-lg font-semibold">Alunos cadastrados</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[#dfe6dd] text-xs uppercase tracking-wide text-[#66736a]">
                <tr>
                  <th className="py-3 pr-4">Nome</th>
                  <th className="py-3 pr-4">Igreja</th>
                  <th className="py-3 pr-4">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-[#edf1eb] last:border-0">
                    <td className="py-3 pr-4 font-medium">{student.name}</td>
                    <td className="py-3 pr-4">{student.church.name}</td>
                    <td className="py-3 pr-4">{getCategoryLabel(student.category)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
