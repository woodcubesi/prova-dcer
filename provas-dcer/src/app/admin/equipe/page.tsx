import { createStaffUserAction, updateStaffUserAction } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminRole } from "@/generated/prisma/client";
import { requireAdminContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type StaffPageProps = {
  searchParams?: Promise<{
    editar?: string;
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
  editingUser?: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
    churchId: string | null;
  } | null;
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

function StaffForm({ canChooseProfile, churches, fixedChurch, editingUser }: StaffFormProps) {
  const isEditing = Boolean(editingUser);
  const selectedRole = editingUser?.role || AdminRole.TEACHER;
  const selectedChurchId = fixedChurch?.id || editingUser?.churchId || "";

  return (
    <form
      action={isEditing ? updateStaffUserAction : createStaffUserAction}
      className="rounded-lg border border-[#dfe6dd] bg-white p-4"
    >
      {editingUser ? <input type="hidden" name="id" value={editingUser.id} /> : null}
      <h2 className="text-lg font-semibold">{isEditing ? "Editar pessoa da equipe" : "Nova pessoa da equipe"}</h2>
      <p className="mt-1 text-sm text-[#66736a]">
        {isEditing
          ? "Atualize os dados e informe nova senha apenas se desejar trocar."
          : canChooseProfile
            ? "Escolha se a pessoa sera administradora, professora ou os dois."
            : "Professores podem cadastrar outros professores da propria igreja."}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Nome completo</span>
          <input
            name="name"
            defaultValue={editingUser?.name || ""}
            className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            placeholder="Ex.: Maria Oliveira"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">E-mail</span>
          <input
            name="email"
            type="email"
            defaultValue={editingUser?.email || ""}
            className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            placeholder="nome@email.com"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">{isEditing ? "Nova senha opcional" : "Senha inicial"}</span>
          <input
            name="password"
            type="password"
            className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            placeholder={isEditing ? "Deixe em branco para manter" : "Minimo 6 caracteres"}
          />
        </label>

        {canChooseProfile ? (
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Perfil</span>
            <select
              name="role"
              defaultValue={selectedRole}
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
              defaultValue={selectedChurchId}
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

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button className="rounded-md bg-[#12382a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1c513d]">
          {isEditing ? "Atualizar equipe" : "Salvar equipe"}
        </button>
        {isEditing ? (
          <a
            href="/admin/equipe"
            className="rounded-md border border-[#dfe6dd] px-4 py-3 text-center text-sm font-semibold text-[#2c6d49] hover:bg-[#f2f7f0]"
          >
            Cancelar
          </a>
        ) : null}
      </div>
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
  const editingUser = params.editar ? staffUsers.find((user) => user.id === params.editar) || null : null;
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
      {params.editar && !editingUser ? (
        <div className="mb-4 rounded-md border border-[#efc2bd] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b2d20]">
          Cadastro de equipe nao encontrado para edicao.
        </div>
      ) : null}

      {(!isTeacherOnly || fixedChurch) ? (
        <StaffForm
          canChooseProfile={!isTeacherOnly}
          churches={churches}
          fixedChurch={fixedChurch}
          editingUser={editingUser}
        />
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
          <div className="mt-3 grid gap-3 md:hidden">
            {staffUsers.map((user) => (
              <div key={user.id} className="rounded-md border border-[#edf1eb] p-3">
                <p className="font-medium">{user.name}</p>
                <p className="mt-1 break-all text-sm text-[#66736a]">{user.email}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-[#effaf2] px-2 py-1 font-medium text-[#1f623e]">
                    {getRoleLabel(user.role)}
                  </span>
                  <span className="rounded-full bg-[#f7faf6] px-2 py-1 text-[#66736a]">
                    {user.church?.name || "Geral"}
                  </span>
                </div>
                <a
                  href={`/admin/equipe?editar=${user.id}`}
                  className="mt-3 inline-flex rounded-md border border-[#2c6d49] px-3 py-2 text-sm font-semibold text-[#2c6d49]"
                >
                  Editar
                </a>
              </div>
            ))}
          </div>
          {staffUsers.length === 0 ? (
            <div className="mt-3 rounded-md border border-[#edf1eb] bg-[#fbfcfa] p-4 text-sm text-[#66736a] md:hidden">
              Nenhum administrador ou professor cadastrado ainda.
            </div>
          ) : null}

          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[#dfe6dd] text-xs uppercase tracking-wide text-[#66736a]">
                <tr>
                  <th className="py-3 pr-4">Nome</th>
                  <th className="py-3 pr-4">E-mail</th>
                  <th className="py-3 pr-4">Perfil</th>
                  <th className="py-3 pr-4">Igreja</th>
                  <th className="py-3 pr-4">Cadastro</th>
                  <th className="py-3 pr-4">Acao</th>
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
                    <td className="py-3 pr-4">
                      <a
                        href={`/admin/equipe?editar=${user.id}`}
                        className="rounded-md border border-[#2c6d49] px-3 py-2 text-sm font-semibold text-[#2c6d49] hover:bg-[#effaf2]"
                      >
                        Editar
                      </a>
                    </td>
                  </tr>
                ))}
                {staffUsers.length === 0 ? (
                  <tr>
                    <td className="py-6 pr-4 text-sm text-[#66736a]" colSpan={6}>
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
