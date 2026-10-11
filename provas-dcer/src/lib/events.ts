import { EventApplicationType, EventLeaderRole } from "@/generated/prisma/client";

export const EVENT_APPLICATION_TYPE_LABELS: Record<EventApplicationType, string> = {
  BIBLICA_ONLINE: "Biblica online",
  BIBLICA_ORAL: "Biblica oral",
  ESPORTIVA_PROVA: "Esportiva - prova",
  ESPORTIVA_JOGOS: "Esportiva - jogos",
  GERAL: "Geral",
};

export const EVENT_LEADER_ROLE_LABELS: Record<EventLeaderRole, string> = {
  CONSELHEIRO: "Conselheiro",
  ORIENTADOR: "Orientador",
};

export function getEventApplicationTypeLabel(type: string) {
  return EVENT_APPLICATION_TYPE_LABELS[type as EventApplicationType] ?? type;
}

export function getEventLeaderRoleLabel(role: string) {
  return EVENT_LEADER_ROLE_LABELS[role as EventLeaderRole] ?? role;
}
