import { createStaffUserAction } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminRole } from "@/generated/prisma/client";
import { requireAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type StaffPageProps = {
  searchParams?: Promise<{
    erro?: string;
    ok?: string;
  }>;
};

type StaffFormProps = {
  role: AdminRole;
  title: string;
  description: string;
  buttonLabel: string;
};

function getRoleLabel(role: AdminRole) {
  return role === AdminRole.ADMIN ? "Administrador" : "Professor";
}

function StaffForm({ role, title, description, buttonLabel }: StaffFormProps) {
  return (
    <form action={createStaffUserAction} className="rounded-lg border border-[#dfe6dd] bg-white p-4">
      <input type="hidden" name="role" value={role} />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-[#66736a]">{description}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Nome completo</span>
          <input
            name="name"
            className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            placeholder="Ex.: Maria Oliveira"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">E-mail</span>
          <input
            name="email"
            type="email"
            className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            placeholder="nome@email.com"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Senha inicial</span>
          <input
            name="password"
            type="password"
            className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            placeholder="Minimo 6 caracteres"
          />
        </label>
      </div>

      <button className="mt-4 rounded-md bg-[#12382a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1c513d]">
        {buttonLabel}
      </button>
    </form>
  );
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  await requireAdminRole([AdminRole.ADMIN]);
  const params = searchParams ? await searchParams : {};

  const staffUsers = await prisma.adminUser.findMany({
    where: { active: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const administrators = staffUsers.filter((user) => user.role === AdminRole.ADMIN);
  const teachers = staffUsers.filter((user) => user.role === AdminRole.TEACHER);

  return (
    <AdminShell
      title="Equipe administrativa"
      description="Cadastre quem administra o sistema e os professores que poderao acessar o painel."
    >
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
        <StaffForm
          role={AdminRole.ADMIN}
          title="Novo administrador"
          description="Administradores podem cadastrar equipe, alunos, igrejas, montar provas e conferir resultados."
          buttonLabel="Salvar administrador"
        />
        <StaffForm
          role={AdminRole.TEACHER}
          title="Novo professor"
          description="Professores acessam o painel para montar provas, acompanhar aplicacoes e conferir respostas."
          buttonLabel="Salvar professor"
        />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-lg border border-[#dfe6dd] bg-white p-4">
          <h2 className="text-lg font-semibold">Resumo</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-md border border-[#edf1eb] px-3 py-3">
              <p className="text-sm text-[#68766d]">Administradores</p>
              <p className="mt-1 text-3xl font-semibold">{administrators.length}</p>
            </div>
            <div className="rounded-md border border-[#edf1eb] px-3 py-3">
              <p className="text-sm text-[#68766d]">Professores</p>
              <p className="mt-1 text-3xl font-semibold">{teachers.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#dfe6dd] bg-white p-4">
          <h2 className="text-lg font-semibold">Pessoas cadastradas</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[#dfe6dd] text-xs uppercase tracking-wide text-[#66736a]">
                <tr>
                  <th className="py-3 pr-4">Nome</th>
                  <th className="py-3 pr-4">E-mail</th>
                  <th className="py-3 pr-4">Perfil</th>
                  <th className="py-3 pr-4">Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {staffUsers.map((user) => (
                  <tr key={user.id} className="border-b border-[#edf1eb] last:border-0">
                    <td className="py-3 pr-4 font-medium">{user.name}</td>
                    <td className="py-3 pr-4">{user.email}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-[#effaf2] px-2 py-1 text-xs font-medium text-[#1f623e]">
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{user.createdAt.toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
                {staffUsers.length === 0 ? (
                  <tr>
                    <td className="py-6 pr-4 text-sm text-[#66736a]" colSpan={4}>
                      Nenhum administrador ou professor cadastrado ainda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
