export function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function calculatePercent(score: number, totalPoints: number) {
  if (!totalPoints) return 0;
  return (score / totalPoints) * 100;
}

export function getApprovalResult(score: number, totalPoints: number, passingPercent: number) {
  const percent = calculatePercent(score, totalPoints);

  return {
    percent,
    errorPercent: Math.max(0, 100 - percent),
    passed: percent >= passingPercent,
    label: percent >= passingPercent ? "Aprovado" : "Reprovado",
  };
}

export function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
