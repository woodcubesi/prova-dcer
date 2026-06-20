import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "provas_admin";
const SESSION_VALUE = "admin";

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || "dev-secret";
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("hex");
}

function buildToken(value = SESSION_VALUE) {
  return `${value}.${sign(value)}`;
}

function isValidToken(token?: string) {
  if (!token) return false;

  const [value, signature] = token.split(".");
  if (!value || !signature) return false;

  const expected = sign(value);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    signatureBuffer.length === expectedBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedBuffer) &&
    value === SESSION_VALUE
  );
}

export async function createAdminSession() {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, buildToken(), {
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

export async function isAdminSession() {
  const cookieStore = await cookies();
  return isValidToken(cookieStore.get(COOKIE_NAME)?.value);
}

export async function requireAdmin() {
  if (!(await isAdminSession())) {
    redirect("/admin/login");
  }
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "admin123";
}
