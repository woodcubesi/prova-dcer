import "dotenv/config";
import { z } from "zod";
import { AdminRole } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

async function main() {
  const values = z.object({
    name: z.string().trim().min(3),
    email: z.string().trim().email().transform((email) => email.toLowerCase()),
    password: z.string().min(6).max(120),
  }).safeParse({
    name: process.env.BOOTSTRAP_ADMIN_NAME,
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || "dcerpaulista",
  });
  if (!values.success) {
    throw new Error("Defina BOOTSTRAP_ADMIN_NAME e BOOTSTRAP_ADMIN_EMAIL. A senha opcional BOOTSTRAP_ADMIN_PASSWORD deve ter de 6 a 120 caracteres.");
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.adminUser.count({ where: { role: { in: [AdminRole.ADMIN, AdminRole.ADMIN_TEACHER] } } });
    if (existing) throw new Error("Ja existe administrador. Use o painel Equipe ou a recuperacao por e-mail.");
    await tx.adminUser.create({
      data: {
        name: values.data.name,
        email: values.data.email,
        passwordHash: hashPassword(values.data.password),
        role: AdminRole.ADMIN,
      },
    });
  }, { isolationLevel: "Serializable" });
  console.log("Primeiro administrador criado. Entre com e-mail e senha e configure o autenticador MFA.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha ao criar administrador.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
