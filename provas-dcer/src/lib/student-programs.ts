import { StudentProgram } from "@/generated/prisma/client";

export const studentProgramLabels: Record<StudentProgram, string> = {
  ER: "Embaixador do Rei",
  MR: "Mensageira do Rei",
};

export const studentProgramOptions = [
  { value: StudentProgram.ER, label: "ER - Embaixador do Rei" },
  { value: StudentProgram.MR, label: "MR - Mensageira do Rei" },
] as const;

export function getStudentProgramLabel(program?: StudentProgram | null) {
  return program ? studentProgramLabels[program] : "-";
}

export function getStudentProgramPrefix(program: StudentProgram) {
  return program === StudentProgram.MR ? "MR" : "ER";
}

export function normalizeRegistrationSuffix(value: string) {
  const normalizedValue = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  return normalizedValue.replace(/^(ER|MR)/, "");
}

export function buildStudentRegistrationNumber(program: StudentProgram, value: string) {
  const suffix = normalizeRegistrationSuffix(value);

  return suffix ? `${getStudentProgramPrefix(program)}${suffix}` : null;
}
