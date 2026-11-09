import { AdminShell } from "@/components/admin/AdminShell";
import { SystemMailForm } from "@/components/admin/SystemMailForm";
import { AdminRole } from "@/generated/prisma/client";
import { requireAdminRole } from "@/lib/auth";
import { getPublicMailConfig } from "@/lib/system-mail-config";

export const dynamic = "force-dynamic";
export default async function SystemPage() {
  const context = await requireAdminRole([AdminRole.ADMIN, AdminRole.ADMIN_TEACHER]);
  const config = await getPublicMailConfig();
  return <AdminShell title="Sistema"><SystemMailForm initial={config} recipient={context.user?.email || ""} /></AdminShell>;
}
