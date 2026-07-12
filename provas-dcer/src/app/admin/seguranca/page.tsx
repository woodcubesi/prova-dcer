import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { AdminRole } from "@/generated/prisma/client";
import { requireAdminRole } from "@/lib/auth";
import { listSystemBackups } from "@/lib/system-backup";

export const dynamic = "force-dynamic";

type SecurityPageProps = {
  searchParams?: Promise<{
    erro?: string;
    ok?: string;
    banco?: string;
    aplicacao?: string;
  }>;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function RestoreOptions() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="flex items-center gap-2 rounded-md border border-[#d8def0] px-3 py-2 text-sm">
        <input name="restoreDatabase" type="checkbox" defaultChecked className="h-4 w-4 accent-[#000060]" />
        Banco de dados
      </label>
      <label className="flex items-center gap-2 rounded-md border border-[#d8def0] px-3 py-2 text-sm">
        <input name="restoreApplication" type="checkbox" defaultChecked className="h-4 w-4 accent-[#000060]" />
        Snapshot da aplicacao
      </label>
    </div>
  );
}

export default async function SecurityPage({ searchParams }: SecurityPageProps) {
  await requireAdminRole([AdminRole.ADMIN, AdminRole.ADMIN_TEACHER]);

  const params = searchParams ? await searchParams : {};
  const backups = await listSystemBackups();

  return (
    <AdminShell
      title="Seguranca"
      description="Backups completos do sistema, com banco de dados e snapshot da aplicacao."
    >
      {params.erro ? (
        <div className="mb-5 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-4 py-3 text-sm text-[#b00018]">
          {params.erro}
        </div>
      ) : null}
      {params.ok === "restaurado" ? (
        <div className="mb-5 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Backup restaurado. Banco: {params.banco === "1" ? "sim" : "nao"}. Aplicacao:{" "}
          {params.aplicacao === "1" ? "snapshot salvo em staging" : "nao"}.
        </div>
      ) : null}
      {params.ok === "backup-excluido" ? (
        <div className="mb-5 rounded-md border border-[#b9dfc7] bg-[#effaf2] px-4 py-3 text-sm text-[#1f623e]">
          Backup excluido com sucesso.
        </div>
      ) : null}

      <section className="mb-5 rounded-lg border border-[#d8def0] bg-white p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-lg font-semibold">Backup completo</h2>
            <p className="mt-1 text-sm text-[#5d6480]">
              O pacote gerado contem dump PostgreSQL, arquivos da aplicacao, manifesto e instrucoes de restore.
            </p>
          </div>
          <Link
            href="/admin/seguranca/backup"
            className="rounded-md bg-[#000060] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#000044]"
          >
            Gerar e baixar backup
          </Link>
        </div>
      </section>

      <section className="mb-5 rounded-lg border border-[#d8def0] bg-white p-4">
        <h2 className="text-lg font-semibold">Restaurar por upload</h2>
        <form
          action="/admin/seguranca/restaurar"
          method="post"
          encType="multipart/form-data"
          className="mt-4 grid gap-3"
        >
          <input type="hidden" name="source" value="upload" />
          <label className="block">
            <span className="text-sm font-medium">Arquivo de backup</span>
            <input
              name="backupFile"
              type="file"
              accept=".tar.gz,.tgz,application/gzip"
              className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#000060]"
            />
          </label>
          <RestoreOptions />
          <label className="block">
            <span className="text-sm font-medium">Confirmacao</span>
            <input
              name="confirmation"
              placeholder="Digite RESTAURAR"
              className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
            />
          </label>
          <button className="w-full rounded-md border border-[#b00018] px-4 py-3 text-sm font-semibold text-[#b00018] hover:bg-[#fff4f2] sm:w-fit">
            Restaurar backup enviado
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-[#d8def0] bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Backups salvos no servidor</h2>
            <p className="text-sm text-[#5d6480]">Os pacotes ficam em volume persistente do Docker.</p>
          </div>
          <span className="rounded-full bg-[#f8faff] px-3 py-1 text-sm font-semibold text-[#000060]">
            {backups.length} arquivo(s)
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {backups.map((backup) => (
            <div key={backup.fileName} className="rounded-md border border-[#e8ecf8] p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="break-all font-mono text-sm font-semibold">{backup.fileName}</p>
                  <p className="mt-1 text-sm text-[#5d6480]">
                    {formatDate(backup.createdAt)} - {formatBytes(backup.size)}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                  <Link
                    href={`/admin/seguranca/backup?arquivo=${encodeURIComponent(backup.fileName)}`}
                    className="rounded-md border border-[#000060] px-3 py-2 text-center text-sm font-semibold text-[#000060] hover:bg-[#f7f8ff]"
                  >
                    Baixar
                  </Link>
                  <form action="/admin/seguranca/backup/excluir" method="post">
                    <input type="hidden" name="backupFileName" value={backup.fileName} />
                    <ConfirmSubmitButton
                      message={`Excluir o backup "${backup.fileName}"? Esta acao nao pode ser desfeita.`}
                      className="w-full rounded-md border border-[#efb6bf] px-3 py-2 text-sm font-semibold text-[#b00018] hover:bg-[#fff4f2]"
                    >
                      Excluir
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
              <form action="/admin/seguranca/restaurar" method="post" className="mt-4 grid gap-3">
                <input type="hidden" name="source" value="server" />
                <input type="hidden" name="backupFileName" value={backup.fileName} />
                <RestoreOptions />
                <label className="block">
                  <span className="text-sm font-medium">Confirmacao</span>
                  <input
                    name="confirmation"
                    placeholder="Digite RESTAURAR"
                    className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
                  />
                </label>
                <button className="w-full rounded-md border border-[#b00018] px-4 py-3 text-sm font-semibold text-[#b00018] hover:bg-[#fff4f2] sm:w-fit">
                  Restaurar este backup
                </button>
              </form>
            </div>
          ))}

          {backups.length === 0 ? (
            <div className="rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-4 text-sm text-[#5d6480]">
              Nenhum backup salvo ainda.
            </div>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
