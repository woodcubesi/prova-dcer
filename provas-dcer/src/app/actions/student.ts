"use server";

import { redirect } from "next/navigation";
import { AttemptStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { filterQuestionsForCategory } from "@/lib/questions";
import {
  findActiveStudentsByRegistrationNumber,
  isRegistrationExpired,
  normalizeRegistrationNumber,
} from "@/lib/student-registration";

function studentError(message: string): never {
  redirect(`/prova?erro=${encodeURIComponent(message)}`);
}

export async function startAttemptAction(formData: FormData) {
  const applicationId = String(formData.get("applicationId") || "");
  const registrationNumber = String(formData.get("registrationNumber") || "");
  const normalizedRegistrationNumber = normalizeRegistrationNumber(registrationNumber);

  if (!applicationId || normalizedRegistrationNumber.length < 3) {
    studentError("Digite o numero da carteirinha e escolha uma prova disponivel.");
  }

  const students = await findActiveStudentsByRegistrationNumber(registrationNumber);

  if (students.length === 0) {
    studentError("Carteirinha nao encontrada. Confira o numero ou procure a coordenacao.");
  }

  if (students.length > 1) {
    studentError("Existe mais de um embaixador com este numero. Procure a coordenacao.");
  }

  const student = students[0];
  const now = new Date();

  if (isRegistrationExpired(student.registrationExpiresAt, now)) {
    studentError("Esta carteirinha esta vencida. Procure a coordenacao.");
  }

  const participant = await prisma.applicationParticipant.findFirst({
    where: {
      applicationId,
      studentId: student.id,
      student: {
        active: true,
      },
    },
    include: {
      application: {
        include: {
          exam: true,
        },
      },
      student: true,
    },
  });

  if (!participant) {
    studentError("Nao ha prova disponivel para esta carteirinha.");
  }

  const application = participant.application;

  if (!application.active) {
    studentError("Esta aplicacao de prova nao esta ativa.");
  }

  if (application.startsAt && now < application.startsAt) {
    studentError("Esta prova ainda nao foi liberada.");
  }

  if (application.endsAt && now > application.endsAt) {
    studentError("Esta prova ja foi encerrada.");
  }

  const existingAttempt = await prisma.attempt.findUnique({
    where: {
      applicationId_studentId: {
        applicationId,
        studentId: participant.studentId,
      },
    },
  });

  if (existingAttempt?.status === AttemptStatus.SUBMITTED) {
    redirect("/prova/finalizada?status=ja-enviada");
  }

  if (existingAttempt) {
    if (existingAttempt.status === AttemptStatus.EXPIRED || now > existingAttempt.expiresAt) {
      await prisma.attempt.update({
        where: { id: existingAttempt.id },
        data: { status: AttemptStatus.EXPIRED },
      });
      redirect("/prova/finalizada?status=expirada");
    }

    redirect(`/prova/${existingAttempt.id}`);
  }

  const attempt = await prisma.attempt.create({
    data: {
      applicationId,
      studentId: participant.studentId,
      expiresAt: new Date(now.getTime() + application.exam.durationMinutes * 60 * 1000),
      totalPoints: 0,
    },
  });

  redirect(`/prova/${attempt.id}`);
}

export async function submitAttemptAction(formData: FormData) {
  const attemptId = String(formData.get("attemptId") || "");

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      student: {
        select: {
          category: true,
        },
      },
      application: {
        include: {
          exam: {
            include: {
              questions: {
                orderBy: { position: "asc" },
                include: {
                  options: {
                    orderBy: { position: "asc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!attempt) {
    redirect("/prova");
  }

  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    redirect("/prova/finalizada?status=ja-enviada");
  }

  const now = new Date();
  const questions = filterQuestionsForCategory(attempt.application.exam.questions, attempt.student.category);

  if (questions.length === 0) {
    redirect("/prova?erro=Esta prova nao possui questoes ativas para sua categoria.");
  }

  const answers = questions.map((question) => {
    const selectedOptionId = String(formData.get(`option_${question.id}`) || "");
    const selectedOption = question.options.find((option) => option.id === selectedOptionId);

    return {
      attemptId: attempt.id,
      questionId: question.id,
      textAnswer: null,
      selectedOptionId: selectedOption?.id || null,
      isCorrect: selectedOption?.isCorrect || false,
      pointsAwarded: selectedOption?.isCorrect ? question.points : 0,
    };
  });

  const score = answers.reduce((sum, answer) => sum + (answer.pointsAwarded || 0), 0);
  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);
  const timeUsedSeconds = Math.max(0, Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000));

  await prisma.$transaction(async (tx) => {
    await tx.answer.deleteMany({
      where: { attemptId: attempt.id },
    });

    await tx.answer.createMany({
      data: answers,
    });

    await tx.attempt.update({
      where: { id: attempt.id },
      data: {
        status: AttemptStatus.SUBMITTED,
        submittedAt: now,
        score,
        totalPoints,
        timeUsedSeconds,
      },
    });
  });

  redirect("/prova/finalizada?status=enviada");
}
