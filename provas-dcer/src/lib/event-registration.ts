export function normalizeEventRegistrationCode(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
}

export function isEventWindowOpen(event: { active: boolean; startsAt?: Date | null; endsAt?: Date | null }, now = new Date()) {
  if (!event.active) return false;
  if (event.startsAt && now < event.startsAt) return false;
  if (event.endsAt && now > event.endsAt) return false;
  return true;
}
