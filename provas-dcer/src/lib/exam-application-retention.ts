import { prisma } from "@/lib/prisma";

type ApplicationDeletionClient = Pick<
  typeof prisma,
  "answer" | "applicationParticipant" | "attempt" | "exam" | "examApplication"
>;

type DeletableApplication = {
  id: string;
  examId: string;
};

export async function deleteExamApplicationRecords(
  client: ApplicationDeletionClient,
  application: DeletableApplication,
) {
  const attempts = await client.attempt.findMany({
    where: {
      applicationId: application.id,
    },
    select: {
      id: true,
    },
  });
  const attemptIds = attempts.map((attempt) => attempt.id);

  if (attemptIds.length > 0) {
    await client.answer.deleteMany({
      where: {
        attemptId: { in: attemptIds },
      },
    });
  }

  await client.attempt.deleteMany({
    where: {
      applicationId: application.id,
    },
  });

  await client.applicationParticipant.deleteMany({
    where: {
      applicationId: application.id,
    },
  });

  await client.examApplication.delete({
    where: {
      id: application.id,
    },
  });

  const remainingApplications = await client.examApplication.count({
    where: {
      examId: application.examId,
    },
  });

  if (remainingApplications === 0) {
    await client.exam.delete({
      where: {
        id: application.examId,
      },
    });
  }
}

export async function backfillMissingApplicationPurgeDates() {
  return prisma.$executeRaw`
    UPDATE "ExamApplication"
    SET "purgeAt" = COALESCE("endsAt", "startsAt", "createdAt") + interval '1 year'
    WHERE "purgeAt" IS NULL
  `;
}

export async function purgeDueExamApplications(now = new Date()) {
  await backfillMissingApplicationPurgeDates();

  const applications = await prisma.examApplication.findMany({
    where: {
      purgeAt: {
        lte: now,
      },
    },
    select: {
      id: true,
      examId: true,
    },
    orderBy: {
      purgeAt: "asc",
    },
  });

  for (const application of applications) {
    await prisma.$transaction(async (tx) => {
      await deleteExamApplicationRecords(tx, application);
    });
  }

  return applications.length;
}
