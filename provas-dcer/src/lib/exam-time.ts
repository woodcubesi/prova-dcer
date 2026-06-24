type StudentExtraTime = {
  hasMedicalReport?: boolean | null;
  extraTimePercent?: number | null;
};

export function getStudentExtraTimePercent(student: StudentExtraTime) {
  if (!student.hasMedicalReport) return 0;

  return Math.min(100, Math.max(0, student.extraTimePercent ?? 0));
}

export function getEffectiveExamDurationMinutes(durationMinutes: number, student: StudentExtraTime) {
  const extraTimePercent = getStudentExtraTimePercent(student);

  return Math.ceil(durationMinutes * (1 + extraTimePercent / 100));
}

export function getAttemptExpirationDate(startedAt: Date, durationMinutes: number, student: StudentExtraTime) {
  return new Date(startedAt.getTime() + getEffectiveExamDurationMinutes(durationMinutes, student) * 60 * 1000);
}
