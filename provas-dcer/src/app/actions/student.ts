"use server";

import { redirect } from "next/navigation";
import { AttemptStatus, Category } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/text";

const categories = ["JUNIOR", "ADOLESCENTES", "JUVENIL"];

function studentError(message: string): never {
  redirect(`/prova?erro=${encodeURIComponent(message)}`);
}

export async function startAttemptAction(formData: FormData) {
  const applicationId = String(formData.get("applicationId") || "");
  const churchId = String(formData.get("churchId") || "");
  const category = String(formData.get("category") || "") as Category;
  const studentName = String(formData.get("studentName") || "").trim();

  if (!applicationId || !churchId || !categories.includes(category) || studentName.length < 3) {
    studentError("Selecione a prova, a igreja, a categoria e digite seu nome.");
  }

  const normalizedName = normalizeName(studentName);
  const participant = await prisma.applicationParticipant.findFirst({
    where: {
      applicationId,
      student: {
        churchId,
        category,
        normalizedName,
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
    studentError("Aluno nao encontrado nesta prova. Confira igreja, categoria e nome.");
  }

  const now = new Date();
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
  const answers = attempt.application.exam.questions.map((question) => {
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
  const totalPoints = attempt.application.exam.questions.reduce((sum, question) => sum + question.points, 0);
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
