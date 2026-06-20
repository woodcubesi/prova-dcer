import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "provas_admin";
const LEGACY_SESSION_VALUE = "admin";
const USER_SESSION_PREFIX = "user:";
const PASSWORD_HASH_PREFIX = "scrypt";

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || "dev-secret";
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("hex");
}

function buildToken(value = LEGACY_SESSION_VALUE) {
  return `${value}.${sign(value)}`;
}

function readSignedValue(token?: string) {
  if (!token) return null;

  const [value, signature] = token.split(".");
  if (!value || !signature) return null;

  const expected = sign(value);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  if (value === LEGACY_SESSION_VALUE || value.startsWith(USER_SESSION_PREFIX)) {
    return value;
  }

  return null;
}

function getUserIdFromSessionValue(value: string | null) {
  if (!value?.startsWith(USER_SESSION_PREFIX)) return null;
  return value.slice(USER_SESSION_PREFIX.length);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${PASSWORD_HASH_PREFIX}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [prefix, salt, hash] = storedHash.split(":");
  if (prefix !== PASSWORD_HASH_PREFIX || !salt || !hash) return false;

  const expectedBuffer = Buffer.from(hash, "hex");
  const actualBuffer = scryptSync(password, salt, 64);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function createAdminSession(userId?: string) {
  const cookieStore = await cookies();
  const value = userId ? `${USER_SESSION_PREFIX}${userId}` : LEGACY_SESSION_VALUE;

  cookieStore.set(COOKIE_NAME, buildToken(value), {
    httpOnly: true,
    maxAge: 60 * 60 * 8,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAdminSessionValue() {
  const cookieStore = await cookies();
  return readSignedValue(cookieStore.get(COOKIE_NAME)?.value);
}

export async function getCurrentAdminUser() {
  const sessionValue = await getAdminSessionValue();
  const userId = getUserIdFromSessionValue(sessionValue);

  if (!userId) return null;

  return prisma.adminUser.findFirst({
    where: {
      id: userId,
      active: true,
    },
  });
}

export async function isAdminSession() {
  return Boolean(await getAdminSessionValue());
}

export async function requireAdmin() {
  if (!(await isAdminSession())) {
    redirect("/admin/login");
  }
}

export async function requireAdminRole(roles: AdminRole[]) {
  const sessionValue = await getAdminSessionValue();

  if (!sessionValue) {
    redirect("/admin/login");
  }

  if (sessionValue === LEGACY_SESSION_VALUE) {
    return;
  }

  const user = await getCurrentAdminUser();

  if (!user || !roles.includes(user.role)) {
    redirect("/admin?erro=permissao");
  }
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "admin123";
}
