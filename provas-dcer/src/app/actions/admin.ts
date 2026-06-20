"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AdminRole, Category, ExamStatus } from "@/generated/prisma/client";
import {
  clearAdminSession,
  createAdminSession,
  getAdminPassword,
  hashPassword,
  requireAdmin,
  requireAdminRole,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/text";

const categorySchema = z.enum(["JUNIOR", "ADOLESCENTES", "JUVENIL"]);
const staffRoleSchema = z.enum(["ADMIN", "TEACHER"]);

const staffUserSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  email: z.string().trim().email("Informe um e-mail valido.").transform((email) => email.toLowerCase()),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres.").max(120),
  role: staffRoleSchema,
});

const optionSchema = z.object({
  label: z.string().trim().min(1).max(3),
  text: z.string().trim().min(1, "Preencha todas as alternativas."),
});

const questionSchema = z
  .object({
    type: z.literal("MULTIPLE_CHOICE", {
      error: "Todas as questoes devem ser de multipla escolha.",
    }),
    statement: z.string().trim().min(5, "A pergunta precisa ter pelo menos 5 caracteres."),
    points: z.coerce.number().positive("A pontuacao precisa ser maior que zero.").max(100),
    options: z.array(optionSchema).min(2, "Questao de multipla escolha precisa ter pelo menos duas alternativas."),
    correctOptionIndex: z.coerce.number().int(),
  })
  .superRefine((question, ctx) => {
    if (
      question.correctOptionIndex < 0 ||
      !question.options[question.correctOptionIndex]
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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function loginAdminAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") || ""));
  const password = String(formData.get("password") || "");

  if (email) {
    const user = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      redirect("/admin/login?erro=senha");
    }

    await createAdminSession(user.id);
    redirect("/admin");
  }

  if (!password || password !== getAdminPassword()) {
    redirect("/admin/login?erro=senha");
  }

  await createAdminSession();
  redirect("/admin");
}

export async function logoutAdminAction() {
  await clearAdminSession();
  redirect("/admin/login");
}

export async function createStaffUserAction(formData: FormData) {
  await requireAdminRole([AdminRole.ADMIN]);

  const parsed = staffUserSchema.safeParse({
    name: String(formData.get("name") || ""),
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || ""),
    role: String(formData.get("role") || ""),
  });

  if (!parsed.success) {
    errorRedirect("/admin/equipe", parsed.error.issues[0]?.message || "Revise os dados da equipe.");
  }

  const staffUser = parsed.data;
  const passwordHash = hashPassword(staffUser.password);

  await prisma.adminUser.upsert({
    where: {
      email: staffUser.email,
    },
    update: {
      name: staffUser.name,
      passwordHash,
      role: staffUser.role as AdminRole,
      active: true,
    },
    create: {
      name: staffUser.name,
      email: staffUser.email,
      passwordHash,
      role: staffUser.role as AdminRole,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/equipe");
  redirect(`/admin/equipe?ok=${staffUser.role === "ADMIN" ? "admin" : "professor"}`);
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
            type: "MULTIPLE_CHOICE",
            points: question.points,
            options: {
              create: question.options.map((option, optionIndex) => ({
                position: optionIndex + 1,
                label: option.label,
                text: option.text,
                isCorrect: optionIndex === question.correctOptionIndex,
              })),
            },
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
