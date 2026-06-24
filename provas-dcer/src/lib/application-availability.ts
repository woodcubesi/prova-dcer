type ApplicationAvailabilityInput = {
  active: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  purgeAt?: Date | null;
};

const applicationTimeZone = "America/Sao_Paulo";
const applicationDateOffset = "-03:00";
export const maximumApplicationRetentionYears = 1;
const dateInputFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: applicationTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDateInput(date?: Date | null) {
  if (!date) return "";

  const parts = Object.fromEntries(dateInputFormatter.formatToParts(date).map((part) => [part.type, part.value]));

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatDateLabel(date?: Date | null, fallback = "-") {
  return date ? date.toLocaleDateString("pt-BR", { timeZone: applicationTimeZone }) : fallback;
}

export function parseApplicationDateInput(value: string, endOfDay = false) {
  const cleanValue = value.trim();
  if (!cleanValue) return null;

  const time = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const date = new Date(`${cleanValue}${time}${applicationDateOffset}`);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function addYearsToDateInput(value: string, years = maximumApplicationRetentionYears) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, monthIndex, day));
  date.setUTCFullYear(date.getUTCFullYear() + years);

  return date.toISOString().slice(0, 10);
}

export function getApplicationStatus(application: ApplicationAvailabilityInput, now = new Date()) {
  if (!application.active) return "inactive";
  if (application.startsAt && now < application.startsAt) return "scheduled";
  if (application.endsAt && now > application.endsAt) return "expired";
  return "active";
}

export function getApplicationStatusLabel(status: string) {
  if (status === "inactive") return "Inativa";
  if (status === "scheduled") return "Agendada";
  if (status === "expired") return "Encerrada";
  return "Ativa";
}

export function formatAvailabilityWindow(application: Pick<ApplicationAvailabilityInput, "startsAt" | "endsAt">) {
  const startsAt = formatDateLabel(application.startsAt, "Imediata");
  const endsAt = formatDateLabel(application.endsAt, "Ilimitada");

  return `${startsAt} ate ${endsAt}`;
}

export function formatPurgeDate(application: Pick<ApplicationAvailabilityInput, "purgeAt">) {
  return formatDateLabel(application.purgeAt, "Nao definida");
}
