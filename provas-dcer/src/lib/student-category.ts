import { AttemptStatus, type Category, type Prisma } from "@/generated/prisma/client";

export class CategoryChangeError extends Error {}

export async function changeStudentCategory(tx: Prisma.TransactionClient, studentId: string, category: Category) {
  const student = await tx.student.findUniqueOrThrow({ where: { id: studentId } });
  if (student.category === category) return;

  const runningAttempt = await tx.attempt.findFirst({
    where: {
      status: AttemptStatus.IN_PROGRESS,
      expiresAt: { gt: new Date() },
      OR: [{ studentId }, { eventRegistration: { studentId } }],
    },
    select: { id: true },
  });
  if (runningAttempt) {
    throw new CategoryChangeError("O aluno possui uma prova em andamento. Aguarde a conclusao para alterar a categoria.");
  }

  const duplicate = await tx.student.findUnique({
    where: {
      churchId_category_normalizedName: {
        churchId: student.churchId,
        category,
        normalizedName: student.normalizedName,
      },
    },
    select: { id: true },
  });
  if (duplicate && duplicate.id !== studentId) {
    throw new CategoryChangeError("Ja existe ER/MR com este nome, igreja e categoria de destino.");
  }

  await tx.student.update({ where: { id: studentId }, data: { category } });
  await tx.eventRegistration.updateMany({ where: { studentId }, data: { category } });
}
