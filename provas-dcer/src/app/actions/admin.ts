"use server";

import { createHash, randomBytes, randomInt } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AdminRole, Category, ExamStatus } from "@/generated/prisma/client";
import {
  addYearsToDateInput,
  formatDateInput,
  maximumApplicationRetentionYears,
  parseApplicationDateInput,
} from "@/lib/application-availability";
import {
  clearAdminSession,
  createAdminSession,
  getAdminPassword,
  getScopedChurchId,
  hasAdministratorAccess,
  hashPassword,
  requireAdminContext,
  requireAdminRole,
  verifyPassword,
} from "@/lib/auth";
import { getAppUrl, sendAdminPasswordResetEmail } from "@/lib/mail";
import { deleteExamApplicationRecords } from "@/lib/exam-application-retention";
import { prisma } from "@/lib/prisma";
import {
  findActiveStudentsByRegistrationNumber,
  normalizeRegistrationNumber,
} from "@/lib/student-registration";
import { normalizeName } from "@/lib/text";

const categorySchema = z.enum(["JUNIOR", "ADOLESCENTES", "JUVENIL"]);
const staffRoleSchema = z.enum(["ADMIN", "TEACHER", "ADMIN_TEACHER"]);
const categoryLabels: Record<Category, string> = {
  JUNIOR: "Junior",
  ADOLESCENTES: "Adolescentes",
  JUVENIL: "Juvenil",
};

const staffUserSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  email: z.string().trim().email("Informe um e-mail valido.").transform((email) => email.toLowerCase()),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres.").max(120),
  role: staffRoleSchema,
  churchId: z.string().trim().optional(),
});

const staffUpdateSchema = staffUserSchema.extend({
  password: z
    .string()
    .trim()
    .max(120)
    .refine((password) => !password || password.length >= 6, "A senha precisa ter pelo menos 6 caracteres.")
    .optional(),
});
const passwordResetExpirationMinutes = 30;
const passwordResetMinIntervalSeconds = 60;
const passwordResetMaxRequestsPerIpHour = 10;
const passwordResetRequestSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido.").transform((email) => email.toLowerCase()),
});
const passwordResetSchema = z
  .object({
    token: z.string().trim().min(20, "Link de redefinicao invalido."),
    password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres.").max(120),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas nao conferem.",
    path: ["confirmPassword"],
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
    category: categorySchema.nullish(),
    theme: z.string().trim().max(120, "O tema da questao esta muito longo.").optional(),
    difficulty: z.string().trim().max(40, "O nivel da questao esta muito longo.").optional(),
    bibleReference: z.string().trim().max(120, "A referencia biblica esta muito longa.").optional(),
    explanation: z.string().trim().max(1000, "A descricao da questao esta muito longa.").optional(),
    sourceStatus: z.string().trim().max(40, "O status da questao esta muito longo.").optional(),
    active: z.boolean().optional().default(true),
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
  passingPercent: z.coerce.number().min(0, "O percentual minimo nao pode ser negativo.").max(100),
  applicationTitle: z.string().trim().min(3, "Informe o titulo da aplicacao."),
  accessCode: z.string().trim().optional(),
  startsAt: z.string().trim().optional(),
  endsAt: z.string().trim().optional(),
  noExpiration: z.boolean().optional().default(false),
  purgeAt: z.string().trim().optional(),
  churchIds: z.array(z.string().min(1)).min(1, "Selecione pelo menos uma igreja."),
  categories: z.array(categorySchema).min(1, "Selecione pelo menos uma categoria."),
  questions: z.array(questionSchema).min(1, "Crie pelo menos uma questao."),
});

function errorRedirect(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

function registersRedirect(ok: string, churchId?: string | null): never {
  const churchParam = churchId ? `&igrejaResponsavel=${encodeURIComponent(churchId)}` : "";
  redirect(`/admin/cadastros?ok=${encodeURIComponent(ok)}${churchParam}`);
}

function buildAccessCode(rawCode?: string) {
  const cleanCode = rawCode?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (cleanCode) return cleanCode.slice(0, 16);

  return `P${randomInt(100000, 999999)}`;
}

function optionalText(value?: string | null) {
  const text = value?.trim();
  return text || null;
}

function optionalFormText(formData: FormData, field: string) {
  return optionalText(String(formData.get(field) || ""));
}

function optionalRegistrationNumber(formData: FormData, field: string) {
  const normalizedRegistrationNumber = normalizeRegistrationNumber(String(formData.get(field) || ""));
  return normalizedRegistrationNumber || null;
}

function parseOptionalDate(formData: FormData, field: string, label: string) {
  const value = String(formData.get(field) || "").trim();

  if (!value) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errorRedirect("/admin/cadastros", `Informe uma data valida para ${label}.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    errorRedirect("/admin/cadastros", `Informe uma data valida para ${label}.`);
  }

  return date;
}

function parsePayloadDate(value: string | undefined, label: string, errorPath: string, endOfDay = false) {
  const cleanValue = value?.trim();

  if (!cleanValue) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) {
    errorRedirect(errorPath, `Informe uma data valida para ${label}.`);
  }

  const date = parseApplicationDateInput(cleanValue, endOfDay);

  if (!date) {
    errorRedirect(errorPath, `Informe uma data valida para ${label}.`);
  }

  return date;
}

function parseApplicationWindow(payload: z.infer<typeof examPayloadSchema>, errorPath: string) {
  const startsAt = parsePayloadDate(payload.startsAt, "liberacao da prova", errorPath);
  const endsAt = payload.noExpiration
    ? null
    : parsePayloadDate(payload.endsAt, "expiracao da prova", errorPath, true);
  const purgeAt = parsePayloadDate(payload.purgeAt, "eliminacao da prova", errorPath, true);

  if (!payload.noExpiration && !endsAt) {
    errorRedirect(errorPath, "Informe a data de expiracao ou marque expiracao ilimitada.");
  }

  if (!purgeAt) {
    errorRedirect(errorPath, "Informe a data de eliminacao da prova.");
  }

  if (startsAt && endsAt && startsAt > endsAt) {
    errorRedirect(errorPath, "A data de liberacao nao pode ser depois da expiracao.");
  }

  const todayInput = formatDateInput(new Date());
  const purgeInput = payload.purgeAt?.trim() || "";
  const startsInput = payload.startsAt?.trim() || "";
  const endsInput = payload.endsAt?.trim() || "";
  const retentionBaseInput = payload.noExpiration ? startsInput || todayInput : endsInput || startsInput || todayInput;
  const maxPurgeInput = addYearsToDateInput(retentionBaseInput);

  if (purgeInput < todayInput) {
    errorRedirect(errorPath, "A data de eliminacao nao pode ficar no passado.");
  }

  if (startsInput && purgeInput < startsInput) {
    errorRedirect(errorPath, "A data de eliminacao nao pode ser antes da liberacao da prova.");
  }

  if (!payload.noExpiration && endsInput && purgeInput < endsInput) {
    errorRedirect(errorPath, "A data de eliminacao nao pode ser antes da expiracao da prova.");
  }

  if (!maxPurgeInput || purgeInput > maxPurgeInput) {
    errorRedirect(
      errorPath,
      `A data de eliminacao nao pode ultrapassar ${maximumApplicationRetentionYears} ano apos a data base da prova.`,
    );
  }

  return { startsAt, endsAt, purgeAt };
}

function parseExamPayload(formData: FormData, errorPath: string) {
  const rawPayload = String(formData.get("payload") || "");
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawPayload || "{}");
  } catch {
    errorRedirect(errorPath, "Revise os dados da prova.");
  }

  const parsed = examPayloadSchema.safeParse(parsedJson);

  if (!parsed.success) {
    errorRedirect(errorPath, parsed.error.issues[0]?.message || "Revise os dados da prova.");
  }

  return parsed.data;
}

function validateQuestionAudience(payload: z.infer<typeof examPayloadSchema>, errorPath: string) {
  const activeQuestions = payload.questions.filter((question) => question.active);

  if (activeQuestions.length === 0) {
    errorRedirect(errorPath, "A prova precisa ter pelo menos uma questao ativa.");
  }

  const missingCategory = payload.categories.find(
    (category) =>
      !activeQuestions.some((question) => !question.category || question.category === category),
  );

  if (missingCategory) {
    errorRedirect(
      errorPath,
      `A categoria ${categoryLabels[missingCategory as Category]} nao possui questoes ativas.`,
    );
  }
}

function resolveExamChurchIds(
  context: Awaited<ReturnType<typeof requireAdminContext>>,
  churchIds: string[],
  errorPath: string,
) {
  const scopedChurchId = getScopedChurchId(context);

  if (context.role === AdminRole.TEACHER && !scopedChurchId) {
    errorRedirect(errorPath, "Seu usuario de conselheiro ainda nao esta vinculado a uma igreja.");
  }

  if (scopedChurchId && churchIds.some((churchId) => churchId !== scopedChurchId)) {
    errorRedirect(errorPath, "Conselheiros so podem aplicar provas para a propria igreja.");
  }

  return scopedChurchId ? [scopedChurchId] : churchIds;
}

async function ensureAccessCodeAvailable(accessCode: string, errorPath: string, ignoredApplicationId?: string) {
  const existingApplication = await prisma.examApplication.findUnique({
    where: { accessCode },
    select: { id: true },
  });

  if (existingApplication && existingApplication.id !== ignoredApplicationId) {
    errorRedirect(errorPath, "Este codigo de aplicacao ja esta em uso.");
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildPasswordResetUrl(token: string) {
  const url = new URL("/admin/redefinir-senha", getAppUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

async function getRequestIp() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || requestHeaders.get("x-real-ip")?.trim() || null;
}

function passwordResetDoneRedirect(): never {
  redirect("/admin/esqueci-senha?ok=1");
}

function passwordResetErrorRedirect(token: string, message: string): never {
  const params = new URLSearchParams({
    erro: message,
  });

  if (token) {
    params.set("token", token);
  }

  redirect(`/admin/redefinir-senha?${params.toString()}`);
}

async function resolveStaffChurch(role: AdminRole, churchId: string | null) {
  if (role === AdminRole.ADMIN) return null;

  if (!churchId) {
    errorRedirect("/admin/equipe", "Selecione a igreja do conselheiro.");
  }

  const churchExists = await prisma.church.findFirst({
    where: {
      id: churchId,
      active: true,
    },
    select: { id: true },
  });

  if (!churchExists) {
    errorRedirect("/admin/equipe", "Igreja do conselheiro nao encontrada.");
  }

  return churchId;
}

async function validateStaffScopeForTeacher(
  target: { role: AdminRole; churchId: string | null } | null,
  role: AdminRole,
  contextChurchId: string | null,
) {
  if (role !== AdminRole.TEACHER) {
    errorRedirect("/admin/equipe", "Conselheiros podem cadastrar apenas outros conselheiros.");
  }

  if (!contextChurchId) {
    errorRedirect("/admin/equipe", "Seu usuario de conselheiro ainda nao esta vinculado a uma igreja.");
  }

  if (target && (target.role !== AdminRole.TEACHER || target.churchId !== contextChurchId)) {
    errorRedirect("/admin/equipe", "Voce so pode editar conselheiros da sua igreja.");
  }
}

async function ensureUniqueStaffEmail(email: string, ignoredId?: string) {
  const existingUser = await prisma.adminUser.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      churchId: true,
    },
  });

  if (existingUser && existingUser.id !== ignoredId) {
    errorRedirect("/admin/equipe", "Este e-mail ja esta cadastrado para outra pessoa.");
  }

  return existingUser;
}

async function ensureUniqueStudent(
  churchId: string,
  category: Category,
  normalizedName: string,
  ignoredId?: string,
) {
  const existingStudent = await prisma.student.findUnique({
    where: {
      churchId_category_normalizedName: {
        churchId,
        category,
        normalizedName,
      },
    },
    select: { id: true },
  });

  if (existingStudent && existingStudent.id !== ignoredId) {
    errorRedirect("/admin/cadastros", "Ja existe embaixador com este nome, igreja e categoria.");
  }
}

async function ensureUniqueStudentExternalId(externalId: string | null, ignoredId?: string) {
  if (!externalId) return;

  const existingStudents = await findActiveStudentsByRegistrationNumber(externalId);
  const existingStudent = existingStudents.find((student) => student.id !== ignoredId);

  if (existingStudent) {
    errorRedirect("/admin/cadastros", "Ja existe embaixador com este numero de inscricao.");
  }
}

export async function loginAdminAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") || ""));
  const password = String(formData.get("password") || "");

  if (email) {
    let user: { id: string; active: boolean; passwordHash: string } | null = null;

    try {
      user = await prisma.adminUser.findUnique({
        where: { email },
        select: {
          id: true,
          active: true,
          passwordHash: true,
        },
      });
    } catch (error) {
      console.error("Admin login lookup failed", error);
      redirect("/admin/login?erro=senha");
    }

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

export async function requestAdminPasswordResetAction(formData: FormData) {
  const parsed = passwordResetRequestSchema.safeParse({
    email: String(formData.get("email") || ""),
  });

  if (!parsed.success) {
    redirect("/admin/esqueci-senha?erro=email");
  }

  const email = parsed.data.email;
  const requestedIp = await getRequestIp();
  const now = new Date();
  const recentRequestDate = new Date(now.getTime() - passwordResetMinIntervalSeconds * 1000);
  const recentIpDate = new Date(now.getTime() - 60 * 60 * 1000);

  const user = await prisma.adminUser.findFirst({
    where: {
      email,
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    passwordResetDoneRedirect();
  }

  await prisma.adminPasswordResetToken.deleteMany({
    where: {
      adminUserId: user.id,
      OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }],
    },
  });

  const recentRequest = await prisma.adminPasswordResetToken.findFirst({
    where: {
      adminUserId: user.id,
      createdAt: { gte: recentRequestDate },
      usedAt: null,
    },
    select: { id: true },
  });

  if (recentRequest) {
    passwordResetDoneRedirect();
  }

  if (requestedIp) {
    const recentIpRequests = await prisma.adminPasswordResetToken.count({
      where: {
        requestedIp,
        createdAt: { gte: recentIpDate },
      },
    });

    if (recentIpRequests >= passwordResetMaxRequestsPerIpHour) {
      passwordResetDoneRedirect();
    }
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashPasswordResetToken(token);
  const expiresAt = new Date(now.getTime() + passwordResetExpirationMinutes * 60 * 1000);

  await prisma.adminPasswordResetToken.create({
    data: {
      adminUserId: user.id,
      tokenHash,
      requestedIp,
      expiresAt,
    },
  });

  try {
    await sendAdminPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: buildPasswordResetUrl(token),
      expiresInMinutes: passwordResetExpirationMinutes,
    });
  } catch (error) {
    console.error("Admin password reset email failed", error);
    await prisma.adminPasswordResetToken.deleteMany({
      where: {
        tokenHash,
        usedAt: null,
      },
    });
  }

  passwordResetDoneRedirect();
}

export async function resetAdminPasswordAction(formData: FormData) {
  const rawToken = String(formData.get("token") || "").trim();
  const parsed = passwordResetSchema.safeParse({
    token: rawToken,
    password: String(formData.get("password") || ""),
    confirmPassword: String(formData.get("confirmPassword") || ""),
  });

  if (!parsed.success) {
    passwordResetErrorRedirect(rawToken, parsed.error.issues[0]?.message || "Revise a nova senha.");
  }

  const tokenHash = hashPasswordResetToken(parsed.data.token);
  const now = new Date();
  const resetToken = await prisma.adminPasswordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: now },
      adminUser: {
        active: true,
      },
    },
    select: {
      id: true,
      adminUserId: true,
    },
  });

  if (!resetToken) {
    passwordResetErrorRedirect("", "Link de redefinicao invalido ou expirado.");
  }

  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: resetToken.adminUserId },
      data: {
        passwordHash: hashPassword(parsed.data.password),
        sessionVersion: { increment: 1 },
      },
    }),
    prisma.adminPasswordResetToken.updateMany({
      where: {
        adminUserId: resetToken.adminUserId,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    }),
  ]);

  await clearAdminSession();
  redirect("/admin/login?senha=alterada");
}

export async function createStaffUserAction(formData: FormData) {
  const context = await requireAdminContext();

  const parsed = staffUserSchema.safeParse({
    name: String(formData.get("name") || ""),
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || ""),
    role: String(formData.get("role") || ""),
    churchId: String(formData.get("churchId") || ""),
  });

  if (!parsed.success) {
    errorRedirect("/admin/equipe", parsed.error.issues[0]?.message || "Revise os dados da equipe.");
  }

  const staffUser = parsed.data;
  const role = staffUser.role as AdminRole;
  let churchId = staffUser.churchId || null;

  if (!hasAdministratorAccess(context)) {
    await validateStaffScopeForTeacher(null, role, context.churchId);
    churchId = context.churchId;
  }

  churchId = await resolveStaffChurch(role, churchId);
  const existingUser = await ensureUniqueStaffEmail(staffUser.email);

  if (
    !hasAdministratorAccess(context) &&
    existingUser &&
    (existingUser.role !== AdminRole.TEACHER || existingUser.churchId !== churchId)
  ) {
    errorRedirect("/admin/equipe", "Este e-mail ja pertence a outro perfil ou igreja.");
  }

  const passwordHash = hashPassword(staffUser.password);

  await prisma.adminUser.upsert({
    where: {
      email: staffUser.email,
    },
    update: {
      name: staffUser.name,
      passwordHash,
      role,
      churchId,
      active: true,
    },
    create: {
      name: staffUser.name,
      email: staffUser.email,
      passwordHash,
      role,
      churchId,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/equipe");
  redirect(`/admin/equipe?ok=${role === AdminRole.ADMIN ? "admin" : "conselheiro"}`);
}

export async function updateStaffUserAction(formData: FormData) {
  const context = await requireAdminContext();
  const id = String(formData.get("id") || "");

  const parsed = staffUpdateSchema.safeParse({
    name: String(formData.get("name") || ""),
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || ""),
    role: String(formData.get("role") || ""),
    churchId: String(formData.get("churchId") || ""),
  });

  if (!id) {
    errorRedirect("/admin/equipe", "Cadastro de equipe nao encontrado.");
  }

  if (!parsed.success) {
    errorRedirect("/admin/equipe", parsed.error.issues[0]?.message || "Revise os dados da equipe.");
  }

  const target = await prisma.adminUser.findFirst({
    where: {
      id,
      active: true,
    },
    select: {
      role: true,
      churchId: true,
    },
  });

  if (!target) {
    errorRedirect("/admin/equipe", "Cadastro de equipe nao encontrado.");
  }

  const staffUser = parsed.data;
  const role = staffUser.role as AdminRole;
  let churchId = staffUser.churchId || null;

  if (!hasAdministratorAccess(context)) {
    await validateStaffScopeForTeacher(target, role, context.churchId);
    churchId = context.churchId;
  }

  churchId = await resolveStaffChurch(role, churchId);
  await ensureUniqueStaffEmail(staffUser.email, id);

  const password = staffUser.password || "";

  await prisma.adminUser.update({
    where: { id },
    data: {
      name: staffUser.name,
      email: staffUser.email,
      role,
      churchId,
      active: true,
      ...(password
        ? {
            passwordHash: hashPassword(password),
            sessionVersion: { increment: 1 },
          }
        : {}),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/equipe");
  redirect("/admin/equipe?ok=equipe");
}

export async function createChurchAction(formData: FormData) {
  await requireAdminRole([AdminRole.ADMIN, AdminRole.ADMIN_TEACHER]);

  const name = String(formData.get("name") || "").trim();
  const embassyName = optionalFormText(formData, "embassyName");
  const city = String(formData.get("city") || "").trim();

  if (name.length < 3) {
    errorRedirect("/admin/cadastros", "Informe o nome da igreja.");
  }

  if (!embassyName || embassyName.length < 3) {
    errorRedirect("/admin/cadastros", "Informe o nome da embaixada.");
  }

  const church = await prisma.church.upsert({
    where: { name },
    update: {
      embassyName,
      city: city || null,
      active: true,
    },
    create: {
      name,
      embassyName,
      city: city || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/cadastros");
  registersRedirect("igreja", church.id);
}

export async function updateChurchAction(formData: FormData) {
  await requireAdminRole([AdminRole.ADMIN, AdminRole.ADMIN_TEACHER]);

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const embassyName = optionalFormText(formData, "embassyName");
  const city = String(formData.get("city") || "").trim();

  if (!id || name.length < 3) {
    errorRedirect("/admin/cadastros", "Informe o nome da igreja.");
  }

  if (!embassyName || embassyName.length < 3) {
    errorRedirect("/admin/cadastros", "Informe o nome da embaixada.");
  }

  const duplicate = await prisma.church.findUnique({
    where: { name },
    select: { id: true },
  });

  if (duplicate && duplicate.id !== id) {
    errorRedirect("/admin/cadastros", "Ja existe uma igreja com este nome.");
  }

  await prisma.church.update({
    where: { id },
    data: {
      name,
      embassyName,
      city: city || null,
      active: true,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/cadastros");
  registersRedirect("igreja", id);
}

export async function createStudentAction(formData: FormData) {
  const context = await requireAdminContext();
  const scopedChurchId = getScopedChurchId(context);

  const name = String(formData.get("name") || "").trim();
  const requestedChurchId = String(formData.get("churchId") || "");
  const churchId = scopedChurchId || requestedChurchId;
  const category = String(formData.get("category") || "") as Category;
  const externalId = optionalRegistrationNumber(formData, "externalId");
  const registrationIssuedAt = parseOptionalDate(formData, "registrationIssuedAt", "emissao");
  const registrationExpiresAt = parseOptionalDate(formData, "registrationExpiresAt", "validade");
  const birthDate = parseOptionalDate(formData, "birthDate", "nascimento");
  const embassyAdmissionDate = parseOptionalDate(formData, "embassyAdmissionDate", "admissao na embaixada");
  const hasMedicalReport = formData.get("hasMedicalReport") === "on";

  if (context.role === AdminRole.TEACHER && !scopedChurchId) {
    errorRedirect("/admin/cadastros", "Seu usuario de conselheiro ainda nao esta vinculado a uma igreja.");
  }

  if (scopedChurchId && requestedChurchId && requestedChurchId !== scopedChurchId) {
    errorRedirect("/admin/cadastros", "Conselheiros so podem cadastrar embaixadores da propria igreja.");
  }

  if (name.length < 3 || !churchId || !categorySchema.safeParse(category).success) {
    errorRedirect("/admin/cadastros", "Preencha igreja, categoria e nome do embaixador.");
  }

  const normalizedName = normalizeName(name);
  await ensureUniqueStudent(churchId, category, normalizedName);
  await ensureUniqueStudentExternalId(externalId);

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
      externalId,
      registrationIssuedAt,
      registrationExpiresAt,
      birthDate,
      embassyAdmissionDate,
      hasMedicalReport,
      active: true,
    },
    create: {
      name,
      normalizedName,
      category,
      externalId,
      registrationIssuedAt,
      registrationExpiresAt,
      birthDate,
      embassyAdmissionDate,
      hasMedicalReport,
      churchId,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/cadastros");
  registersRedirect("embaixador", churchId);
}

export async function updateStudentAction(formData: FormData) {
  const context = await requireAdminContext();
  const scopedChurchId = getScopedChurchId(context);
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const requestedChurchId = String(formData.get("churchId") || "");
  const churchId = scopedChurchId || requestedChurchId;
  const category = String(formData.get("category") || "") as Category;
  const externalId = optionalRegistrationNumber(formData, "externalId");
  const registrationIssuedAt = parseOptionalDate(formData, "registrationIssuedAt", "emissao");
  const registrationExpiresAt = parseOptionalDate(formData, "registrationExpiresAt", "validade");
  const birthDate = parseOptionalDate(formData, "birthDate", "nascimento");
  const embassyAdmissionDate = parseOptionalDate(formData, "embassyAdmissionDate", "admissao na embaixada");
  const hasMedicalReport = formData.get("hasMedicalReport") === "on";

  if (context.role === AdminRole.TEACHER && !scopedChurchId) {
    errorRedirect("/admin/cadastros", "Seu usuario de conselheiro ainda nao esta vinculado a uma igreja.");
  }

  if (scopedChurchId && requestedChurchId && requestedChurchId !== scopedChurchId) {
    errorRedirect("/admin/cadastros", "Conselheiros so podem editar embaixadores da propria igreja.");
  }

  if (!id || name.length < 3 || !churchId || !categorySchema.safeParse(category).success) {
    errorRedirect("/admin/cadastros", "Preencha igreja, categoria e nome do embaixador.");
  }

  const target = await prisma.student.findFirst({
    where: {
      id,
      active: true,
      ...(scopedChurchId ? { churchId: scopedChurchId } : {}),
    },
    select: { id: true },
  });

  if (!target) {
    errorRedirect("/admin/cadastros", "Embaixador nao encontrado.");
  }

  const normalizedName = normalizeName(name);
  await ensureUniqueStudent(churchId, category, normalizedName, id);
  await ensureUniqueStudentExternalId(externalId, id);

  await prisma.student.update({
    where: { id },
    data: {
      name,
      normalizedName,
      category,
      externalId,
      registrationIssuedAt,
      registrationExpiresAt,
      birthDate,
      embassyAdmissionDate,
      hasMedicalReport,
      churchId,
      active: true,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/cadastros");
  registersRedirect("embaixador", churchId);
}

export async function createExamAction(formData: FormData) {
  const context = await requireAdminContext();
  const errorPath = "/admin/provas/nova";
  const payload = parseExamPayload(formData, errorPath);
  validateQuestionAudience(payload, errorPath);
  const applicationWindow = parseApplicationWindow(payload, errorPath);
  const churchIds = resolveExamChurchIds(context, payload.churchIds, errorPath);

  const accessCode = buildAccessCode(payload.accessCode);
  await ensureAccessCodeAvailable(accessCode, errorPath);

  const students = await prisma.student.findMany({
    where: {
      active: true,
      churchId: { in: churchIds },
      category: { in: payload.categories as Category[] },
    },
    select: { id: true },
  });

  if (students.length === 0) {
    errorRedirect("/admin/provas/nova", "Nao ha embaixadores cadastrados para os filtros escolhidos.");
  }

  const application = await prisma.$transaction(async (tx) => {
    const exam = await tx.exam.create({
      data: {
        title: payload.title,
        description: payload.description || null,
        durationMinutes: payload.durationMinutes,
        passingPercent: payload.passingPercent,
        status: ExamStatus.PUBLISHED,
        questions: {
          create: payload.questions.map((question, questionIndex) => ({
            position: questionIndex + 1,
            statement: question.statement,
            type: "MULTIPLE_CHOICE",
            points: question.points,
            category: question.category ? (question.category as Category) : null,
            theme: optionalText(question.theme),
            difficulty: optionalText(question.difficulty),
            bibleReference: optionalText(question.bibleReference),
            explanation: optionalText(question.explanation),
            sourceStatus: optionalText(question.sourceStatus),
            active: question.active,
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
        startsAt: applicationWindow.startsAt,
        endsAt: applicationWindow.endsAt,
        purgeAt: applicationWindow.purgeAt,
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
  revalidatePath("/admin/provas");
  revalidatePath("/prova");
  redirect(`/admin?criada=${application.accessCode}`);
}

export async function updateExamAction(formData: FormData) {
  const context = await requireAdminContext();
  const applicationId = String(formData.get("applicationId") || "");
  const errorPath = applicationId ? `/admin/provas/${applicationId}/editar` : "/admin/provas";

  if (!applicationId) {
    errorRedirect(errorPath, "Aplicacao de prova nao encontrada.");
  }

  const payload = parseExamPayload(formData, errorPath);
  validateQuestionAudience(payload, errorPath);
  const applicationWindow = parseApplicationWindow(payload, errorPath);
  const churchIds = resolveExamChurchIds(context, payload.churchIds, errorPath);
  const scopedChurchId = getScopedChurchId(context);
  const accessCode = buildAccessCode(payload.accessCode);

  const application = await prisma.examApplication.findFirst({
    where: {
      id: applicationId,
      ...(scopedChurchId
        ? {
            participants: {
              some: {
                student: {
                  churchId: scopedChurchId,
                },
              },
            },
          }
        : {}),
    },
    include: {
      exam: {
        select: { id: true },
      },
      attempts: {
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!application) {
    errorRedirect(errorPath, "Aplicacao de prova nao encontrada.");
  }

  await ensureAccessCodeAvailable(accessCode, errorPath, application.id);

  if (application.attempts.length > 0) {
    await prisma.examApplication.update({
      where: { id: application.id },
      data: {
        title: payload.applicationTitle,
        accessCode,
        startsAt: applicationWindow.startsAt,
        endsAt: applicationWindow.endsAt,
        purgeAt: applicationWindow.purgeAt,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/provas");
    revalidatePath(`/admin/provas/${application.id}/editar`);
    revalidatePath("/prova");
    redirect("/admin/provas?ok=editada");
  }

  const students = await prisma.student.findMany({
    where: {
      active: true,
      churchId: { in: churchIds },
      category: { in: payload.categories as Category[] },
    },
    select: { id: true },
  });

  if (students.length === 0) {
    errorRedirect(errorPath, "Nao ha embaixadores cadastrados para os filtros escolhidos.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.applicationParticipant.deleteMany({
      where: {
        applicationId: application.id,
      },
    });

    await tx.question.deleteMany({
      where: {
        examId: application.exam.id,
      },
    });

    await tx.exam.update({
      where: {
        id: application.exam.id,
      },
      data: {
        title: payload.title,
        description: payload.description || null,
        durationMinutes: payload.durationMinutes,
        passingPercent: payload.passingPercent,
        status: ExamStatus.PUBLISHED,
        questions: {
          create: payload.questions.map((question, questionIndex) => ({
            position: questionIndex + 1,
            statement: question.statement,
            type: "MULTIPLE_CHOICE",
            points: question.points,
            category: question.category ? (question.category as Category) : null,
            theme: optionalText(question.theme),
            difficulty: optionalText(question.difficulty),
            bibleReference: optionalText(question.bibleReference),
            explanation: optionalText(question.explanation),
            sourceStatus: optionalText(question.sourceStatus),
            active: question.active,
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

    await tx.examApplication.update({
      where: {
        id: application.id,
      },
      data: {
        title: payload.applicationTitle,
        accessCode,
        active: true,
        startsAt: applicationWindow.startsAt,
        endsAt: applicationWindow.endsAt,
        purgeAt: applicationWindow.purgeAt,
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
  revalidatePath("/admin/provas");
  revalidatePath(`/admin/provas/${application.id}/editar`);
  revalidatePath("/prova");
  redirect("/admin/provas?ok=editada");
}

export async function deleteExamApplicationAction(formData: FormData) {
  const context = await requireAdminContext();
  const applicationId = String(formData.get("applicationId") || "");

  if (!applicationId) {
    errorRedirect("/admin/provas", "Aplicacao de prova nao encontrada.");
  }

  const application = await prisma.examApplication.findFirst({
    where: {
      id: applicationId,
    },
    include: {
      exam: {
        select: { id: true },
      },
      participants: {
        select: {
          student: {
            select: {
              churchId: true,
            },
          },
        },
      },
    },
  });

  if (!application) {
    errorRedirect("/admin/provas", "Aplicacao de prova nao encontrada.");
  }

  if (!hasAdministratorAccess(context)) {
    if (!context.churchId) {
      errorRedirect("/admin/provas", "Seu usuario de conselheiro ainda nao esta vinculado a uma igreja.");
    }

    const hasOutsideChurch = application.participants.some(
      (participant) => participant.student.churchId !== context.churchId,
    );

    if (hasOutsideChurch) {
      errorRedirect("/admin/provas", "Conselheiros so podem excluir provas da propria igreja.");
    }
  }

  await prisma.$transaction(async (tx) => {
    await deleteExamApplicationRecords(tx, {
      id: application.id,
      examId: application.exam.id,
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/provas");
  revalidatePath("/admin/correcao");
  revalidatePath("/prova");
  redirect("/admin/provas?ok=excluida");
}
