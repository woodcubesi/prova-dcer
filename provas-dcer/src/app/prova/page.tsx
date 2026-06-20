import Link from "next/link";
import { StudentEntry } from "@/components/exam/StudentEntry";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type StudentEntryPageProps = {
  searchParams?: Promise<{
    erro?: string;
  }>;
};

export default async function StudentEntryPage({ searchParams }: StudentEntryPageProps) {
  const params = searchParams ? await searchParams : {};
  const now = new Date();

  const applications = await prisma.examApplication.findMany({
    where: {
      active: true,
      AND: [
        {
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        },
        {
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      exam: true,
      participants: {
        where: {
          student: {
            active: true,
          },
        },
        include: {
          student: {
            include: {
              church: true,
            },
          },
        },
      },
    },
  });

  const serializedApplications = applications.map((application) => ({
    id: application.id,
    title: application.title,
    examTitle: application.exam.title,
    accessCode: application.accessCode,
    durationMinutes: application.exam.durationMinutes,
    participants: application.participants.map((participant) => ({
      id: participant.student.id,
      name: participant.student.name,
      category: participant.student.category,
      churchId: participant.student.churchId,
      churchName: participant.student.church.name,
    })),
  }));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-5 sm:px-6">
      <header className="rounded-lg bg-[#12382a] p-5 text-white">
        <Link href="/" className="text-sm font-semibold text-[#b7e4c7]">
          Provas DCER Paulista
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Entrada do aluno</h1>
        <p className="mt-2 text-sm leading-6 text-[#e8f5ee]">
          Escolha sua igreja e categoria, digite seu nome e depois selecione uma prova disponivel.
        </p>
      </header>

      {params.erro ? (
        <div className="mt-4 rounded-md border border-[#efc2bd] bg-[#fff4f2] px-4 py-3 text-sm text-[#9b2d20]">
          {params.erro}
        </div>
      ) : null}

      <section className="mt-4">
        {serializedApplications.length ? (
          <StudentEntry applications={serializedApplications} />
        ) : (
          <div className="rounded-lg border border-[#dfe6dd] bg-white p-6 text-sm text-[#66736a]">
            Nenhuma prova ativa no momento.
          </div>
        )}
      </section>
    </main>
  );
}
