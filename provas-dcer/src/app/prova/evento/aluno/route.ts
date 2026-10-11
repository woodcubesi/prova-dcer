import { NextResponse } from "next/server";
import { AttemptStatus } from "@/generated/prisma/client";
import { getCategoryLabel } from "@/lib/categories";
import { normalizeEventRegistrationCode, isEventWindowOpen } from "@/lib/event-registration";
import { getEventApplicationTypeLabel } from "@/lib/events";
import { prisma } from "@/lib/prisma";

type LookupPayload = {
  registrationCode?: unknown;
};

function isoDate(date?: Date | null) {
  return date ? date.toISOString() : null;
}

function isApplicationOpen(
  application: { active: boolean; startsAt?: Date | null; endsAt?: Date | null; purgeAt?: Date | null },
  now: Date,
) {
  if (!application.active) return false;
  if (application.startsAt && now < application.startsAt) return false;
  if (application.endsAt && now > application.endsAt) return false;
  if (application.purgeAt && now > application.purgeAt) return false;
  return true;
}

export async function POST(request: Request) {
  let payload: LookupPayload;

  try {
    payload = (await request.json()) as LookupPayload;
  } catch {
    return NextResponse.json({ message: "Informe o numero de inscricao do evento." }, { status: 400 });
  }

  const registrationCode = normalizeEventRegistrationCode(
    typeof payload.registrationCode === "string" ? payload.registrationCode : "",
  );

  if (registrationCode.length !== 6) {
    return NextResponse.json({ message: "Informe o numero de inscricao do evento com 6 caracteres." }, { status: 400 });
  }

  const now = new Date();
  const registration = await prisma.eventRegistration.findUnique({
    where: { registrationCode },
    include: {
      church: true,
      event: true,
      assignments: {
        orderBy: { createdAt: "asc" },
        include: {
          eventApplication: {
            include: {
              application: {
                include: {
                  exam: {
                    select: {
                      durationMinutes: true,
                      title: true,
                    },
                  },
                  attempts: {
                    where: {
                      eventRegistration: {
                        registrationCode,
                      },
                    },
                    select: {
                      expiresAt: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!registration) {
    return NextResponse.json({ message: "Inscricao de evento nao encontrada." }, { status: 404 });
  }

  if (!isEventWindowOpen(registration.event, now)) {
    return NextResponse.json({ message: "Este evento nao esta liberado para provas agora." }, { status: 403 });
  }

  const availableApplications = registration.assignments
    .map((assignment) => assignment.eventApplication)
    .filter((eventApplication) => {
      const application = eventApplication.application;

      if (!isApplicationOpen(application, now)) return false;

      const attempt = application.attempts[0];

      if (!attempt) return true;

      return attempt.status === AttemptStatus.IN_PROGRESS && now <= attempt.expiresAt;
    });

  return NextResponse.json({
    registration: {
      registrationCode: registration.registrationCode,
      name: registration.name,
      category: registration.category,
      categoryLabel: getCategoryLabel(registration.category),
      churchName: registration.church.name,
      eventTitle: registration.event.title,
    },
    applications: availableApplications.map((eventApplication) => ({
      id: eventApplication.application.id,
      title: eventApplication.application.title,
      examTitle: eventApplication.application.exam.title,
      eventTypeLabel: getEventApplicationTypeLabel(eventApplication.type),
      durationMinutes: eventApplication.application.exam.durationMinutes,
      baseDurationMinutes: eventApplication.application.exam.durationMinutes,
      endsAt: isoDate(eventApplication.application.endsAt),
      alreadyStarted: eventApplication.application.attempts[0]?.status === AttemptStatus.IN_PROGRESS,
    })),
  });
}
