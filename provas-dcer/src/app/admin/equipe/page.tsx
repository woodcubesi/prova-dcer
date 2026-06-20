import { createStaffUserAction } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminRole } from "@/generated/prisma/client";
import { requireAdminContext } from "@/lib/auth";
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
  churches?: {
    id: string;
    name: string;
  }[];
  fixedChurch?: {
    id: string;
    name: string;
  } | null;
};

function getRoleLabel(role: AdminRole) {
  return role === AdminRole.ADMIN ? "Administrador" : "Professor";
}

function StaffForm({ role, title, description, buttonLabel, churches = [], fixedChurch }: StaffFormProps) {
  const needsChurch = role === AdminRole.TEACHER;

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

        {needsChurch && fixedChurch ? (
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Igreja</span>
            <input type="hidden" name="churchId" value={fixedChurch.id} />
            <div className="mt-1 rounded-md border border-[#cdd8cf] bg-[#f7faf6] px-3 py-3 text-sm">
              {fixedChurch.name}
            </div>
          </label>
        ) : null}

        {needsChurch && !fixedChurch ? (
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Igreja do professor</span>
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
        ) : null}
      </div>

      <button className="mt-4 rounded-md bg-[#12382a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1c513d]">
        {buttonLabel}
      </button>
    </form>
  );
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const context = await requireAdminContext();
  const params = searchParams ? await searchParams : {};
  const isTeacher = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacher ? context.churchId : null;

  const [staffUsers, churches] = await Promise.all([
    prisma.adminUser.findMany({
      where: {
        active: true,
        ...(isTeacher
          ? {
              role: AdminRole.TEACHER,
              churchId: scopedChurchId || "__missing_church__",
            }
          : {}),
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: {
        church: true,
      },
    }),
    prisma.church.findMany({
      where: {
        active: true,
        ...(isTeacher ? { id: scopedChurchId || "__missing_church__" } : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  const fixedChurch = isTeacher ? churches[0] || null : null;

  const administrators = staffUsers.filter((user) => user.role === AdminRole.ADMIN);
  const teachers = staffUsers.filter((user) => user.role === AdminRole.TEACHER);

  return (
    <AdminShell
      title="Equipe administrativa"
      description={
        isTeacher
          ? "Cadastre professores da sua igreja."
          : "Cadastre quem administra o sistema e os professores vinculados a cada igreja."
      }
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
      {params.ok ? (
        <div className="mb-4 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Cadastro salvo.
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {!isTeacher ? (
          <StaffForm
            role={AdminRole.ADMIN}
            title="Novo administrador"
            description="Administradores podem cadastrar equipe, alunos, igrejas, montar provas e conferir resultados."
            buttonLabel="Salvar administrador"
          />
        ) : null}
        {(!isTeacher || fixedChurch) ? (
          <StaffForm
            role={AdminRole.TEACHER}
            title="Novo professor"
            description={
              isTeacher
                ? "O novo professor ficara vinculado a sua igreja."
                : "Professores acessam apenas alunos, provas e correcoes da igreja selecionada."
            }
            buttonLabel="Salvar professor"
            churches={churches}
            fixedChurch={fixedChurch}
          />
        ) : null}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-lg border border-[#dfe6dd] bg-white p-4">
          <h2 className="text-lg font-semibold">Resumo</h2>
          <div className="mt-4 grid gap-3">
            {!isTeacher ? (
              <div className="rounded-md border border-[#edf1eb] px-3 py-3">
                <p className="text-sm text-[#68766d]">Administradores</p>
                <p className="mt-1 text-3xl font-semibold">{administrators.length}</p>
              </div>
            ) : null}
            <div className="rounded-md border border-[#edf1eb] px-3 py-3">
              <p className="text-sm text-[#68766d]">Professores</p>
              <p className="mt-1 text-3xl font-semibold">{teachers.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#dfe6dd] bg-white p-4">
          <h2 className="text-lg font-semibold">Pessoas cadastradas</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[#dfe6dd] text-xs uppercase tracking-wide text-[#66736a]">
                <tr>
                  <th className="py-3 pr-4">Nome</th>
                  <th className="py-3 pr-4">E-mail</th>
                  <th className="py-3 pr-4">Perfil</th>
                  <th className="py-3 pr-4">Igreja</th>
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
                    <td className="py-3 pr-4">{user.church?.name || "Geral"}</td>
                    <td className="py-3 pr-4">{user.createdAt.toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
                {staffUsers.length === 0 ? (
                  <tr>
                    <td className="py-6 pr-4 text-sm text-[#66736a]" colSpan={5}>
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
