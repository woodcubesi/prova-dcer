import { prisma } from "@/lib/prisma";

export function normalizeRegistrationNumber(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

export function isRegistrationExpired(expiresAt?: Date | null, now = new Date()) {
  if (!expiresAt) return false;

  const endOfExpirationDay = new Date(expiresAt);
  endOfExpirationDay.setUTCHours(23, 59, 59, 999);

  return now > endOfExpirationDay;
}

export async function findActiveStudentsByRegistrationNumber(registrationNumber: string) {
  const normalizedRegistrationNumber = normalizeRegistrationNumber(registrationNumber);

  if (normalizedRegistrationNumber.length < 3) {
    return [];
  }

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM "Student"
    WHERE active = true
      AND "externalId" IS NOT NULL
      AND regexp_replace(upper("externalId"), '[^A-Z0-9]', '', 'g') = ${normalizedRegistrationNumber}
    ORDER BY "updatedAt" DESC
    LIMIT 3
  `;

  if (!rows.length) {
    return [];
  }

  const orderedIds = rows.map((row) => row.id);
  const students = await prisma.student.findMany({
    where: {
      id: {
        in: orderedIds,
      },
    },
    include: {
      church: true,
    },
  });
  const studentById = new Map(students.map((student) => [student.id, student]));

  return orderedIds.flatMap((id) => {
    const student = studentById.get(id);
    return student ? [student] : [];
  });
}
