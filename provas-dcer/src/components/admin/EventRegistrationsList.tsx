import Link from "next/link";
import { deleteEventRegistrationAction } from "@/app/actions/admin";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { getCategoryLabel } from "@/lib/categories";
import { getEventLeaderRoleLabel } from "@/lib/events";

type EventRegistrationListItem = {
  id: string;
  name: string;
  registrationCode: string;
  category: string;
  program: string;
  leaderName: string;
  leaderRole: string;
  church: {
    name: string;
  };
  assignments: {
    id: string;
    eventApplication: {
      application: {
        title: string;
      };
    };
  }[];
};

type EventRegistrationsListProps = {
  eventId: string;
  registrations: EventRegistrationListItem[];
};

export function EventRegistrationsList({ eventId, registrations }: EventRegistrationsListProps) {
  return (
    <div className="grid gap-3">
      {registrations.map((registration) => (
        <div key={registration.id} className="rounded-md border border-[#e8ecf8] p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{registration.name}</p>
                <span className="rounded-full bg-[#f8faff] px-2 py-1 text-xs font-semibold text-[#000060]">
                  {registration.program}
                </span>
                <span className="rounded-full bg-[#effaf2] px-2 py-1 font-mono text-xs font-semibold text-[#1f623e]">
                  {registration.registrationCode}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#5d6480]">
                {registration.church.name} - {getCategoryLabel(registration.category)}
              </p>
              <p className="mt-1 text-sm text-[#5d6480]">
                Lider: {registration.leaderName} ({getEventLeaderRoleLabel(registration.leaderRole)})
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/admin/eventos/${eventId}/inscricoes/${registration.id}/cracha`}
                className="rounded-md bg-[#000060] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#000044]"
              >
                Baixar cracha
              </Link>
              <form action={deleteEventRegistrationAction}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="registrationId" value={registration.id} />
                <ConfirmSubmitButton
                  message={`Excluir inscricao de "${registration.name}"?`}
                  className="rounded-md border border-[#efb6bf] px-3 py-2 text-sm font-semibold text-[#b00018] hover:bg-[#fff4f2]"
                >
                  Excluir inscricao
                </ConfirmSubmitButton>
              </form>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {registration.assignments.map((assignment) => (
              <span key={assignment.id} className="rounded-full bg-[#f8faff] px-3 py-1 text-xs font-semibold text-[#000060]">
                {assignment.eventApplication.application.title}
              </span>
            ))}
          </div>
        </div>
      ))}
      {registrations.length === 0 ? (
        <div className="rounded-md border border-[#e8ecf8] bg-[#fbfcff] p-4 text-sm text-[#5d6480]">
          Nenhuma inscricao cadastrada neste evento.
        </div>
      ) : null}
    </div>
  );
}
