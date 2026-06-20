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

type ChurchOption = {
  id: string;
  name: string;
};

type StaffFormProps = {
  canChooseProfile: boolean;
  churches: ChurchOption[];
  fixedChurch?: ChurchOption | null;
};

function getRoleLabel(role: AdminRole) {
  if (role === AdminRole.ADMIN) return "Administrador";
  if (role === AdminRole.ADMIN_TEACHER) return "Administrador + Professor";
  return "Professor";
}

function isTeacherProfile(role: AdminRole) {
  return role === AdminRole.TEACHER || role === AdminRole.ADMIN_TEACHER;
}

function isAdministratorProfile(role: AdminRole) {
  return role === AdminRole.ADMIN || role === AdminRole.ADMIN_TEACHER;
}

function StaffForm({ canChooseProfile, churches, fixedChurch }: StaffFormProps) {
  return (
    <form action={createStaffUserAction} className="rounded-lg border border-[#dfe6dd] bg-white p-4">
      <h2 className="text-lg font-semibold">Nova pessoa da equipe</h2>
      <p className="mt-1 text-sm text-[#66736a]">
        {canChooseProfile
          ? "Escolha se a pessoa sera administradora, professora ou os dois."
          : "Professores podem cadastrar outros professores da propria igreja."}
      </p>

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

        {canChooseProfile ? (
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Perfil</span>
            <select
              name="role"
              defaultValue={AdminRole.TEACHER}
              className="mt-1 w-full rounded-md border border-[#cdd8cf] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            >
              <option value={AdminRole.ADMIN}>Administrador</option>
              <option value={AdminRole.TEACHER}>Professor</option>
              <option value={AdminRole.ADMIN_TEACHER}>Administrador + Professor</option>
            </select>
          </label>
        ) : (
          <input type="hidden" name="role" value={AdminRole.TEACHER} />
        )}

        {fixedChurch ? (
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Igreja</span>
            <input type="hidden" name="churchId" value={fixedChurch.id} />
            <div className="mt-1 rounded-md border border-[#cdd8cf] bg-[#f7faf6] px-3 py-3 text-sm">
              {fixedChurch.name}
            </div>
          </label>
        ) : (
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Igreja quando tambem for professor</span>
            <select
              name="churchId"
              className="mt-1 w-full rounded-md border border-[#cdd8cf] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            >
              <option value="">Sem igreja / apenas administrador</option>
              {churches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <button className="mt-4 rounded-md bg-[#12382a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1c513d]">
        Salvar equipe
      </button>
    </form>
  );
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const context = await requireAdminContext();
  const params = searchParams ? await searchParams : {};
  const isTeacherOnly = context.role === AdminRole.TEACHER;
  const scopedChurchId = isTeacherOnly ? context.churchId : null;

  const [staffUsers, churches] = await Promise.all([
    prisma.adminUser.findMany({
      where: {
        active: true,
        ...(isTeacherOnly
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
        ...(isTeacherOnly ? { id: scopedChurchId || "__missing_church__" } : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  const fixedChurch = isTeacherOnly ? churches[0] || null : null;
  const administrators = staffUsers.filter((user) => isAdministratorProfile(user.role));
  const teachers = staffUsers.filter((user) => isTeacherProfile(user.role));

  return (
    <AdminShell
      title="Equipe administrativa"
      description={
        isTeacherOnly
          ? "Cadastre professores da sua igreja."
          : "Cadastre administradores, professores ou pessoas com os dois perfis."
      }
    >
      {isTeacherOnly && !scopedChurchId ? (
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

      {(!isTeacherOnly || fixedChurch) ? (
        <StaffForm canChooseProfile={!isTeacherOnly} churches={churches} fixedChurch={fixedChurch} />
      ) : null}

      <section className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-lg border border-[#dfe6dd] bg-white p-4">
          <h2 className="text-lg font-semibold">Resumo</h2>
          <div className="mt-4 grid gap-3">
            {!isTeacherOnly ? (
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
