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
  const [churchId, setChurchId] = useState("");
  const [category, setCategory] = useState("");
  const [studentName, setStudentName] = useState("");
  const [applicationId, setApplicationId] = useState("");

  const churches = useMemo(() => {
    const map = new Map<string, string>();
    applications.forEach((application) => {
      application.participants.forEach((participant) => {
        map.set(participant.churchId, participant.churchName);
      });
    });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [applications]);

  const studentOptions = useMemo(() => {
    const names = new Set<string>();

    applications.forEach((application) => {
      application.participants
        .filter((participant) => (!churchId || participant.churchId === churchId) && (!category || participant.category === category))
        .forEach((participant) => names.add(participant.name));
    });

    return [...names].sort((a, b) => a.localeCompare(b));
  }, [applications, category, churchId]);

  const normalizedStudentName = normalizeStudentName(studentName);
  const canChooseApplication = Boolean(churchId && category && normalizedStudentName.length >= 3);

  const availableApplications = useMemo(() => {
    if (!canChooseApplication) return [];

    return applications.filter((application) =>
      application.participants.some(
        (participant) =>
          participant.churchId === churchId &&
          participant.category === category &&
          normalizeStudentName(participant.name) === normalizedStudentName,
      ),
    );
  }, [applications, canChooseApplication, category, churchId, normalizedStudentName]);

  const selectedApplicationId = availableApplications.some((item) => item.id === applicationId) ? applicationId : "";
  const application = availableApplications.find((item) => item.id === selectedApplicationId);

  function resetApplicationSelection() {
    setApplicationId("");
  }

  return (
    <form action={startAttemptAction} className="rounded-lg border border-[#d8def0] bg-white p-4 shadow-sm sm:p-6">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Igreja</span>
            <select
              name="churchId"
              value={churchId}
              onChange={(event) => {
                setChurchId(event.target.value);
                setStudentName("");
                resetApplicationSelection();
              }}
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
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
                resetApplicationSelection();
              }}
              className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
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
            onChange={(event) => {
              setStudentName(event.target.value);
              resetApplicationSelection();
            }}
            list="student-names"
            className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060]"
            placeholder="Digite igual ao cadastro"
            autoComplete="off"
          />
          <datalist id="student-names">
            {studentOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <span className="mt-1 block text-xs text-[#5d6480]">
            A lista sugere apenas alunos da igreja e categoria selecionadas.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Prova disponivel</span>
          <select
            name="applicationId"
            value={selectedApplicationId}
            onChange={(event) => setApplicationId(event.target.value)}
            disabled={!availableApplications.length}
            className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f2f4fb] disabled:text-[#888fa8]"
          >
            {!canChooseApplication ? (
              <option value="">Informe igreja, categoria e nome primeiro</option>
            ) : null}
            {canChooseApplication && !availableApplications.length ? (
              <option value="">Nenhuma prova disponivel para este aluno</option>
            ) : null}
            {availableApplications.length ? <option value="">Selecione a prova</option> : null}
            {availableApplications.map((item) => (
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

        <button
          disabled={!selectedApplicationId}
          className="rounded-md bg-[#000060] px-5 py-3 text-sm font-semibold text-white hover:bg-[#000044] disabled:cursor-not-allowed disabled:bg-[#888fa8]"
        >
          Iniciar prova
        </button>
      </div>
    </form>
  );
}

function normalizeStudentName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
