"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AttemptStatus, Category, ExamStatus, QuestionType } from "@/generated/prisma/client";
import { clearAdminSession, createAdminSession, getAdminPassword, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/text";

const categorySchema = z.enum(["JUNIOR", "ADOLESCENTES", "JUVENIL"]);

const optionSchema = z.object({
  label: z.string().trim().min(1).max(3),
  text: z.string().trim().min(1, "Preencha todas as alternativas."),
});

const questionSchema = z
  .object({
    type: z.enum(["MULTIPLE_CHOICE", "TEXT"]),
    statement: z.string().trim().min(5, "A pergunta precisa ter pelo menos 5 caracteres."),
    points: z.coerce.number().positive("A pontuacao precisa ser maior que zero.").max(100),
    options: z.array(optionSchema).optional(),
    correctOptionIndex: z.coerce.number().int().optional(),
  })
  .superRefine((question, ctx) => {
    if (question.type !== "MULTIPLE_CHOICE") return;

    if (!question.options || question.options.length < 2) {
      ctx.addIssue({
        code: "custom",
        message: "Questao objetiva precisa ter pelo menos duas alternativas.",
        path: ["options"],
      });
    }

    if (
      question.correctOptionIndex === undefined ||
      question.correctOptionIndex < 0 ||
      !question.options?.[question.correctOptionIndex]
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Selecione a alternativa correta de cada questao objetiva.",
        path: ["correctOptionIndex"],
      });
    }
  });

const examPayloadSchema = z.object({
  title: z.string().trim().min(3, "Informe o titulo da prova."),
  description: z.string().trim().optional(),
  durationMinutes: z.coerce.number().int().min(1).max(300),
  applicationTitle: z.string().trim().min(3, "Informe o titulo da aplicacao."),
  accessCode: z.string().trim().optional(),
  churchIds: z.array(z.string().min(1)).min(1, "Selecione pelo menos uma igreja."),
  categories: z.array(categorySchema).min(1, "Selecione pelo menos uma categoria."),
  questions: z.array(questionSchema).min(1, "Crie pelo menos uma questao."),
});

function errorRedirect(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

function buildAccessCode(rawCode?: string) {
  const cleanCode = rawCode?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (cleanCode) return cleanCode.slice(0, 16);

  return `P${randomInt(100000, 999999)}`;
}

export async function loginAdminAction(formData: FormData) {
  const password = String(formData.get("password") || "");

  if (password !== getAdminPassword()) {
    redirect("/admin/login?erro=senha");
  }

  await createAdminSession();
  redirect("/admin");
}

export async function logoutAdminAction() {
  await clearAdminSession();
  redirect("/admin/login");
}

export async function createChurchAction(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const city = String(formData.get("city") || "").trim();

  if (name.length < 3) {
    errorRedirect("/admin/cadastros", "Informe o nome da igreja.");
  }

  await prisma.church.upsert({
    where: { name },
    update: {
      city: city || null,
      active: true,
    },
    create: {
      name,
      city: city || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/cadastros");
  redirect("/admin/cadastros?ok=igreja");
}

export async function createStudentAction(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const churchId = String(formData.get("churchId") || "");
  const category = String(formData.get("category") || "") as Category;

  if (name.length < 3 || !churchId || !categorySchema.safeParse(category).success) {
    errorRedirect("/admin/cadastros", "Preencha igreja, categoria e nome do aluno.");
  }

  const normalizedName = normalizeName(name);

  await prisma.student.upsert({
    where: {
      churchId_category_normalizedName: {
        churchId,
        category,
        normalizedName,
      },
    },
    update: {
      name,
      active: true,
    },
    create: {
      name,
      normalizedName,
      category,
      churchId,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/cadastros");
  redirect("/admin/cadastros?ok=aluno");
}

export async function createExamAction(formData: FormData) {
  await requireAdmin();

  const rawPayload = String(formData.get("payload") || "");
  const parsedJson = JSON.parse(rawPayload || "{}") as unknown;
  const parsed = examPayloadSchema.safeParse(parsedJson);

  if (!parsed.success) {
    errorRedirect("/admin/provas/nova", parsed.error.issues[0]?.message || "Revise os dados da prova.");
  }

  const payload = parsed.data;
  const accessCode = buildAccessCode(payload.accessCode);

  const students = await prisma.student.findMany({
    where: {
      active: true,
      churchId: { in: payload.churchIds },
      category: { in: payload.categories as Category[] },
    },
    select: { id: true },
  });

  if (students.length === 0) {
    errorRedirect("/admin/provas/nova", "Nao ha alunos cadastrados para os filtros escolhidos.");
  }

  const application = await prisma.$transaction(async (tx) => {
    const exam = await tx.exam.create({
      data: {
        title: payload.title,
        description: payload.description || null,
        durationMinutes: payload.durationMinutes,
        status: ExamStatus.PUBLISHED,
        questions: {
          create: payload.questions.map((question, questionIndex) => ({
            position: questionIndex + 1,
            statement: question.statement,
            type: question.type as QuestionType,
            points: question.points,
            options:
              question.type === "MULTIPLE_CHOICE"
                ? {
                    create: question.options!.map((option, optionIndex) => ({
                      position: optionIndex + 1,
                      label: option.label,
                      text: option.text,
                      isCorrect: optionIndex === question.correctOptionIndex,
                    })),
                  }
                : undefined,
          })),
        },
      },
    });

    return tx.examApplication.create({
      data: {
        examId: exam.id,
        title: payload.applicationTitle,
        accessCode,
        active: true,
        showResultToStudent: false,
        participants: {
          create: students.map((student) => ({
            studentId: student.id,
          })),
        },
      },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/prova");
  redirect(`/admin?criada=${application.accessCode}`);
}

export async function updateManualGradesAction(formData: FormData) {
  await requireAdmin();

  const attemptId = String(formData.get("attemptId") || "");
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      application: {
        include: {
          exam: {
            include: {
              questions: true,
            },
          },
        },
      },
      answers: {
        include: {
          question: true,
        },
      },
    },
  });

  if (!attempt) {
    redirect("/admin/correcao");
  }

  const updates = attempt.answers
    .filter((answer) => answer.question.type === QuestionType.TEXT)
    .map((answer) => {
      const rawPoints = String(formData.get(`points_${answer.id}`) || "").trim();
      const comment = String(formData.get(`comment_${answer.id}`) || "").trim();
      const parsedPoints = rawPoints === "" ? null : Number(rawPoints);
      const pointsAwarded =
        parsedPoints === null
          ? null
          : Math.min(Math.max(parsedPoints, 0), answer.question.points);

      return prisma.answer.update({
        where: { id: answer.id },
        data: {
          pointsAwarded,
          manualComment: comment || null,
          isCorrect: pointsAwarded === null ? null : pointsAwarded >= answer.question.points,
        },
      });
    });

  if (updates.length) {
    await prisma.$transaction(updates);
  }

  const refreshedAttempt = await prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      application: {
        include: {
          exam: {
            include: {
              questions: true,
            },
          },
        },
      },
      answers: true,
    },
  });

  const score = refreshedAttempt.answers.reduce((sum, answer) => sum + (answer.pointsAwarded || 0), 0);
  const totalPoints = refreshedAttempt.application.exam.questions.reduce(
    (sum, question) => sum + question.points,
    0,
  );

  await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      score,
      totalPoints,
      status: AttemptStatus.SUBMITTED,
    },
  });

  revalidatePath("/admin/correcao");
  revalidatePath(`/admin/correcao/${attemptId}`);
  redirect(`/admin/correcao/${attemptId}?ok=correcao`);
}
