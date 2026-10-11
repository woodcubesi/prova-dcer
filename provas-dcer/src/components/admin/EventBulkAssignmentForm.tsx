"use client";

import { useMemo, useState } from "react";
import { bulkAssignEventStudentsAction } from "@/app/actions/admin";
import { getCategoryLabel } from "@/lib/categories";

type ChurchOption = {
  id: string;
  name: string;
  embassyName: string | null;
};

type StudentOption = {
  id: string;
  name: string;
  category: string;
  program: string;
  churchId: string;
  churchName: string;
  eventApplicationIds: string[];
};

type LeaderOption = {
  id: string;
  name: string;
  churchId: string | null;
  churchName: string | null;
};

type EventApplicationOption = {
  id: string;
  title: string;
  examTitle: string;
  typeLabel: string;
};

type EventBulkAssignmentFormProps = {
  eventId: string;
  churches: ChurchOption[];
  students: StudentOption[];
  leaders: LeaderOption[];
  applications: EventApplicationOption[];
  defaultChurchId: string;
  defaultLeaderUserId: string;
};

function churchLabel(church: ChurchOption) {
  return church.embassyName ? `${church.name} - ${church.embassyName}` : church.name;
}

export function EventBulkAssignmentForm({
  eventId,
  churches,
  students,
  leaders,
  applications,
  defaultChurchId,
  defaultLeaderUserId,
}: EventBulkAssignmentFormProps) {
  const fixedChurch = churches.length === 1 ? churches[0] : null;
  const [churchId, setChurchId] = useState(defaultChurchId || fixedChurch?.id || "");
  const [eventApplicationId, setEventApplicationId] = useState("");
  const [leaderUserId, setLeaderUserId] = useState(defaultLeaderUserId || (leaders.length === 1 ? leaders[0].id : ""));

  const filteredStudents = useMemo(
    () => students.filter((student) => !churchId || student.churchId === churchId),
    [churchId, students],
  );
  const filteredLeaders = useMemo(
    () => leaders.filter((leader) => !churchId || !leader.churchId || leader.churchId === churchId),
    [churchId, leaders],
  );
  const leaderSelectValue = filteredLeaders.some((leader) => leader.id === leaderUserId) ? leaderUserId : "";
  const availableStudentCount = filteredStudents.filter(
    (student) => !eventApplicationId || !student.eventApplicationIds.includes(eventApplicationId),
  ).length;

  return (
    <form action={bulkAssignEventStudentsAction} className="grid gap-4" data-form-draft-id={`event-bulk-assignment-${eventId}`}>
      <input type="hidden" name="eventId" value={eventId} />

      <div className="grid gap-3 lg:grid-cols-2">
        {fixedChurch ? (
          <label className="block">
            <span className="text-sm font-medium">Igreja ou embaixada</span>
            <input type="hidden" name="churchId" value={fixedChurch.id} />
            <div className="mt-1 rounded-md border border-[#c5cce4] bg-[#f8faff] px-3 py-3 text-sm">
              {churchLabel(fixedChurch)}
            </div>
          </label>
        ) : (
          <label className="block">
            <span className="text-sm font-medium">Igreja ou embaixada</span>
            <select
              name="churchId"
              value={churchId}
              onChange={(event) => {
                setChurchId(event.target.value);
                setLeaderUserId("");
              }}
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
            >
              <option value="">Selecione a igreja</option>
              {churches.map((church) => (
                <option key={church.id} value={church.id}>
                  {churchLabel(church)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="text-sm font-medium">Prova para vincular</span>
          <select
            name="eventApplicationId"
            value={eventApplicationId}
            onChange={(event) => setEventApplicationId(event.target.value)}
            className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
          >
            <option value="">Selecione a prova</option>
            {applications.map((application) => (
              <option key={application.id} value={application.id}>
                {application.title} - {application.typeLabel}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Conselheiro ou orientador</span>
          <select
            name="leaderUserId"
            value={leaderSelectValue}
            onChange={(event) => setLeaderUserId(event.target.value)}
            disabled={!churchId}
            className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f2f4fb]"
          >
            <option value="">{churchId ? "Selecione no cadastro de equipe" : "Escolha uma igreja primeiro"}</option>
            {filteredLeaders.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.name}
                {leader.churchName ? ` - ${leader.churchName}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Funcao no evento</span>
          <select
            name="leaderRole"
            defaultValue="CONSELHEIRO"
            className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
          >
            <option value="CONSELHEIRO">Conselheiro</option>
            <option value="ORIENTADOR">Orientador</option>
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Alunos desta igreja</legend>
        <div className="mt-2 grid max-h-80 gap-2 overflow-auto rounded-md border border-[#e8ecf8] p-2 lg:grid-cols-2">
          {filteredStudents.map((student) => {
            const alreadyLinked = Boolean(eventApplicationId && student.eventApplicationIds.includes(eventApplicationId));

            return (
              <label
                key={`${student.id}-${eventApplicationId || "none"}`}
                className="flex items-start gap-3 rounded-md border border-[#e8ecf8] px-3 py-3"
              >
                <input
                  name="studentIds"
                  type="checkbox"
                  value={student.id}
                  disabled={!eventApplicationId || alreadyLinked}
                  defaultChecked={alreadyLinked}
                  className="mt-1 h-5 w-5 accent-[#000060] disabled:opacity-50"
                />
                <span>
                  <span className="block text-sm font-semibold">
                    {student.program} - {student.name}
                  </span>
                  <span className="text-xs text-[#5d6480]">
                    {student.churchName} - {getCategoryLabel(student.category)}
                  </span>
                  {alreadyLinked ? (
                    <span className="mt-1 block text-xs font-semibold text-[#1f623e]">Ja vinculado a esta prova</span>
                  ) : null}
                </span>
              </label>
            );
          })}
          {filteredStudents.length === 0 ? (
            <p className="p-2 text-sm text-[#5d6480]">Nenhum aluno ativo encontrado para esta igreja.</p>
          ) : null}
        </div>
      </fieldset>

      <div>
        <button
          disabled={!churchId || !eventApplicationId || !leaderSelectValue || availableStudentCount === 0}
          className="rounded-md bg-[#000060] px-5 py-3 text-sm font-semibold text-white hover:bg-[#000044] disabled:cursor-not-allowed disabled:bg-[#888fa8]"
        >
          Vincular selecionados
        </button>
      </div>
    </form>
  );
}
