"use client";

import { useMemo, useState } from "react";
import { startAttemptAction } from "@/app/actions/student";
import { CATEGORIES } from "@/lib/categories";

type ParticipantOption = {
  id: string;
  name: string;
  category: string;
  churchId: string;
  churchName: string;
};

type ApplicationOption = {
  id: string;
  title: string;
  examTitle: string;
  accessCode: string;
  durationMinutes: number;
  participants: ParticipantOption[];
};

export function StudentEntry({ applications }: { applications: ApplicationOption[] }) {
  const [applicationId, setApplicationId] = useState(applications[0]?.id || "");
  const [churchId, setChurchId] = useState("");
  const [category, setCategory] = useState("");
  const [studentName, setStudentName] = useState("");

  const application = applications.find((item) => item.id === applicationId);
  const churches = useMemo(() => {
    const map = new Map<string, string>();
    application?.participants.forEach((participant) => {
      map.set(participant.churchId, participant.churchName);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [application]);

  const studentOptions = useMemo(() => {
    return (
      application?.participants
        .filter((participant) => (!churchId || participant.churchId === churchId) && (!category || participant.category === category))
        .map((participant) => participant.name)
        .sort((a, b) => a.localeCompare(b)) || []
    );
  }, [application, category, churchId]);

  function handleApplicationChange(value: string) {
    setApplicationId(value);
    setChurchId("");
    setCategory("");
    setStudentName("");
  }

  return (
    <form action={startAttemptAction} className="rounded-lg border border-[#dfe6dd] bg-white p-4 shadow-sm sm:p-6">
      <div className="grid gap-4">
        <label className="block">
          <span className="text-sm font-medium">Prova</span>
          <select
            name="applicationId"
            value={applicationId}
            onChange={(event) => handleApplicationChange(event.target.value)}
            className="mt-1 w-full rounded-md border border-[#cdd8cf] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
          >
            {applications.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} - {item.examTitle}
              </option>
            ))}
          </select>
        </label>

        {application ? (
          <div className="rounded-md bg-[#effaf2] px-3 py-2 text-sm text-[#1f623e]">
            Tempo total: <strong>{application.durationMinutes} minutos</strong>. Codigo:{" "}
            <span className="font-mono">{application.accessCode}</span>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Igreja</span>
            <select
              name="churchId"
              value={churchId}
              onChange={(event) => {
                setChurchId(event.target.value);
                setStudentName("");
              }}
              className="mt-1 w-full rounded-md border border-[#cdd8cf] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            >
              <option value="">Selecione sua igreja</option>
              {churches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Categoria</span>
            <select
              name="category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setStudentName("");
              }}
              className="mt-1 w-full rounded-md border border-[#cdd8cf] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            >
              <option value="">Selecione sua categoria</option>
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Digite seu nome</span>
          <input
            name="studentName"
            value={studentName}
            onChange={(event) => setStudentName(event.target.value)}
            list="student-names"
            className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            placeholder="Digite igual ao cadastro"
            autoComplete="off"
          />
          <datalist id="student-names">
            {studentOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <span className="mt-1 block text-xs text-[#66736a]">
            A lista sugere apenas alunos da igreja e categoria selecionadas.
          </span>
        </label>

        <button className="rounded-md bg-[#12382a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1c513d]">
          Iniciar prova
        </button>
      </div>
    </form>
  );
}
