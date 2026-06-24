import { NextResponse } from "next/server";
import { AttemptStatus } from "@/generated/prisma/client";
import { getCategoryLabel } from "@/lib/categories";
import { getEffectiveExamDurationMinutes, getStudentExtraTimePercent } from "@/lib/exam-time";
import { prisma } from "@/lib/prisma";
import {
  findActiveStudentsByRegistrationNumber,
  isRegistrationExpired,
  normalizeRegistrationNumber,
} from "@/lib/student-registration";

type LookupPayload = {
  registrationNumber?: unknown;
};

function isoDate(date?: Date | null) {
  return date ? date.toISOString() : null;
}

export async function POST(request: Request) {
  let payload: LookupPayload;

  try {
    payload = (await request.json()) as LookupPayload;
  } catch {
    return NextResponse.json({ message: "Informe o numero da carteirinha." }, { status: 400 });
  }

  const registrationNumber = typeof payload.registrationNumber === "string" ? payload.registrationNumber : "";
  const normalizedRegistrationNumber = normalizeRegistrationNumber(registrationNumber);

  if (normalizedRegistrationNumber.length < 3) {
    return NextResponse.json({ message: "Informe o numero da carteirinha." }, { status: 400 });
  }

  const students = await findActiveStudentsByRegistrationNumber(registrationNumber);

  if (students.length === 0) {
    return NextResponse.json(
      { message: "Carteirinha nao encontrada. Confira o numero ou procure a coordenacao." },
      { status: 404 },
    );
  }

  if (students.length > 1) {
    return NextResponse.json(
      { message: "Existe mais de um embaixador com este numero. Procure a coordenacao." },
      { status: 409 },
    );
  }

  const student = students[0];
  const now = new Date();

  if (isRegistrationExpired(student.registrationExpiresAt, now)) {
    return NextResponse.json(
      { message: "Esta carteirinha esta vencida. Procure a coordenacao." },
      { status: 403 },
    );
  }

  const applications = await prisma.examApplication.findMany({
    where: {
      active: true,
      AND: [
        {
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        },
        {
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
        {
          OR: [{ purgeAt: null }, { purgeAt: { gt: now } }],
        },
      ],
      participants: {
        some: {
          studentId: student.id,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      exam: {
        select: {
          durationMinutes: true,
          title: true,
        },
      },
      attempts: {
        where: {
          studentId: student.id,
        },
        select: {
          expiresAt: true,
          status: true,
        },
      },
    },
  });

  const availableApplications = applications.filter((application) => {
    const attempt = application.attempts[0];

    if (!attempt) return true;

    return attempt.status === AttemptStatus.IN_PROGRESS && now <= attempt.expiresAt;
  });

  return NextResponse.json({
    student: {
      registrationNumber: student.externalId || normalizedRegistrationNumber,
      name: student.name,
      category: student.category,
      categoryLabel: getCategoryLabel(student.category),
      churchName: student.church.name,
      embassyName: student.church.embassyName,
      registrationIssuedAt: isoDate(student.registrationIssuedAt),
      registrationExpiresAt: isoDate(student.registrationExpiresAt),
      birthDate: isoDate(student.birthDate),
      embassyAdmissionDate: isoDate(student.embassyAdmissionDate),
      hasMedicalReport: student.hasMedicalReport,
      extraTimePercent: getStudentExtraTimePercent(student),
    },
    applications: availableApplications.map((application) => ({
      id: application.id,
      title: application.title,
      examTitle: application.exam.title,
      durationMinutes: getEffectiveExamDurationMinutes(application.exam.durationMinutes, student),
      baseDurationMinutes: application.exam.durationMinutes,
      endsAt: isoDate(application.endsAt),
      alreadyStarted: application.attempts[0]?.status === AttemptStatus.IN_PROGRESS,
    })),
  });
}
