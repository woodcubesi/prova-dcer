"use client";

import { useMemo, useState } from "react";
import { createEventRegistrationAction } from "@/app/actions/admin";
import { CATEGORIES, getCategoryLabel } from "@/lib/categories";

type RegistrationMode = "existing" | "adhoc";
type ParticipantProgram = "ER" | "MR";

type ChurchOption = {
  id: string;
  name: string;
  embassyName: string | null;
};

type StudentOption = {
  id: string;
  name: string;
  category: string;
  program: ParticipantProgram;
  churchId: string;
  churchName: string;
  alreadyRegistered: boolean;
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

export type EventRegistrationInitialValues = {
  mode: RegistrationMode;
  churchId: string;
  studentId: string;
  name: string;
  category: string;
  program: ParticipantProgram;
  birthDate: string;
  leaderUserId: string;
  leaderRole: string;
  eventApplicationIds: string[];
};

type EventRegistrationFormProps = {
  eventId: string;
  maxApplicationsPerParticipant: number;
  churches: ChurchOption[];
  students: StudentOption[];
  leaders: LeaderOption[];
  applications: EventApplicationOption[];
  initialValues: EventRegistrationInitialValues;
};

const leaderRoles = [
  { value: "CONSELHEIRO", label: "Conselheiro" },
  { value: "ORIENTADOR", label: "Orientador" },
] as const;
const participantPrograms = [
  { value: "ER", label: "Embaixador (ER)" },
  { value: "MR", label: "Mensageira (MR)" },
] as const;

function churchLabel(church: ChurchOption) {
  return church.embassyName ? `${church.name} - ${church.embassyName}` : church.name;
}

export function EventRegistrationForm({
  eventId,
  maxApplicationsPerParticipant,
  churches,
  students,
  leaders,
  applications,
  initialValues,
}: EventRegistrationFormProps) {
  const fixedChurch = churches.length === 1 ? churches[0] : null;
  const initialChurchId = initialValues.churchId || fixedChurch?.id || "";
  const initialLeaderUserId = initialValues.leaderUserId || (leaders.length === 1 ? leaders[0].id : "");
  const [mode, setMode] = useState<RegistrationMode>(initialValues.mode);
  const [churchId, setChurchId] = useState(initialChurchId);
  const [studentId, setStudentId] = useState(initialValues.studentId);
  const [program, setProgram] = useState<ParticipantProgram>(initialValues.program);
  const [leaderUserId, setLeaderUserId] = useState(initialLeaderUserId);

  const filteredStudents = useMemo(
    () => students.filter((student) => !churchId || student.churchId === churchId),
    [churchId, students],
  );
  const filteredLeaders = useMemo(
    () => leaders.filter((leader) => !churchId || !leader.churchId || leader.churchId === churchId),
    [churchId, leaders],
  );
  const studentSelectValue = filteredStudents.some((student) => student.id === studentId) ? studentId : "";
  const leaderSelectValue = filteredLeaders.some((leader) => leader.id === leaderUserId) ? leaderUserId : "";
  const selectedApplicationIds = new Set(initialValues.eventApplicationIds);

  return (
    <form action={createEventRegistrationAction} className="grid gap-4" data-form-draft-id={`event-registration-${eventId}`}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="registrationMode" value={mode} />

      <fieldset>
        <legend className="text-sm font-medium">Origem do inscrito</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-md border border-[#d8def0] px-3 py-3">
            <input
              type="radio"
              name="registrationModeChoice"
              value="existing"
              checked={mode === "existing"}
              onChange={() => setMode("existing")}
              className="mt-1 h-5 w-5 accent-[#000060]"
            />
            <span>
              <span className="block text-sm font-semibold">ER/MR cadastrado</span>
              <span className="text-xs text-[#5d6480]">Escolha a igreja e depois o aluno ja existente.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-md border border-[#d8def0] px-3 py-3">
            <input
              type="radio"
              name="registrationModeChoice"
              value="adhoc"
              checked={mode === "adhoc"}
              onChange={() => {
                setMode("adhoc");
                setStudentId("");
              }}
              className="mt-1 h-5 w-5 accent-[#000060]"
            />
            <span>
              <span className="block text-sm font-semibold">Avulso neste evento</span>
              <span className="text-xs text-[#5d6480]">Use quando o participante ainda nao existe no cadastro geral.</span>
            </span>
          </label>
        </div>
      </fieldset>

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
                setStudentId("");
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

        {mode === "existing" ? (
          <label className="block">
            <span className="text-sm font-medium">ER/MR desta igreja</span>
            <select
              name="studentId"
              value={studentSelectValue}
              onChange={(event) => setStudentId(event.target.value)}
              disabled={!churchId}
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f2f4fb]"
            >
              <option value="">{churchId ? "Selecione o ER/MR" : "Escolha uma igreja primeiro"}</option>
              {filteredStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.program} - {student.name} - {getCategoryLabel(student.category)}
                  {student.alreadyRegistered ? " (ja inscrito)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {mode === "adhoc" ? (
          <>
            <label className="block">
              <span className="text-sm font-medium">Nome do inscrito avulso</span>
              <input
                name="name"
                defaultValue={initialValues.name}
                minLength={3}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Categoria</span>
              <select
                name="category"
                defaultValue={initialValues.category}
                className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              >
                <option value="">Selecione a categoria</option>
                {CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="block">
              <legend className="text-sm font-medium">Tipo do inscrito</legend>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                {participantPrograms.map((participantProgram) => (
                  <label
                    key={participantProgram.value}
                    className="flex items-center gap-3 rounded-md border border-[#c5cce4] px-3 py-3"
                  >
                    <input
                      type="radio"
                      name="program"
                      value={participantProgram.value}
                      checked={program === participantProgram.value}
                      onChange={() => setProgram(participantProgram.value)}
                      className="h-5 w-5 accent-[#000060]"
                    />
                    <span className="text-sm font-semibold">{participantProgram.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-sm font-medium">Nascimento opcional</span>
              <input
                name="birthDate"
                type="date"
                defaultValue={initialValues.birthDate}
                className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
              />
            </label>
          </>
        ) : null}

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
            defaultValue={initialValues.leaderRole || "CONSELHEIRO"}
            className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
          >
            {leaderRoles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">
          Provas permitidas para o inscrito (maximo {maxApplicationsPerParticipant})
        </legend>
        <div className="mt-2 grid gap-2 lg:grid-cols-2">
          {applications.map((application) => (
            <label key={application.id} className="flex items-start gap-3 rounded-md border border-[#e8ecf8] px-3 py-3">
              <input
                name="eventApplicationIds"
                type="checkbox"
                value={application.id}
                defaultChecked={selectedApplicationIds.has(application.id)}
                className="mt-1 h-5 w-5 accent-[#000060]"
              />
              <span>
                <span className="block text-sm font-medium">{application.title}</span>
                <span className="text-xs text-[#5d6480]">
                  {application.typeLabel} - {application.examTitle}
                </span>
              </span>
            </label>
          ))}
        </div>
        {applications.length === 0 ? (
          <p className="mt-2 text-sm text-[#5d6480]">Vincule pelo menos uma prova antes de cadastrar inscricoes.</p>
        ) : null}
      </fieldset>

      <div>
        <button
          disabled={applications.length === 0 || churches.length === 0 || leaders.length === 0}
          className="rounded-md bg-[#000060] px-5 py-3 text-sm font-semibold text-white hover:bg-[#000044] disabled:cursor-not-allowed disabled:bg-[#888fa8]"
        >
          Salvar inscricao
        </button>
      </div>
    </form>
  );
}
