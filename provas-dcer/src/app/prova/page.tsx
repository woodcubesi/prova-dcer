import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";
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

  const activeApplicationCount = await prisma.examApplication.count({
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
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-5 sm:px-6">
      <header className="overflow-hidden rounded-lg bg-[#000060] text-white shadow-sm">
        <div className="h-1.5 bg-[#fff200]" />
        <div className="p-5">
          <BrandLockup compact />
          <Link href="/" className="mt-4 inline-flex text-sm font-semibold text-[#fff200]">
            Provas DCER Paulista
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">Entrada do embaixador</h1>
          <p className="mt-2 text-sm leading-6 text-[#f8f9ff]">
            Digite o numero da carteirinha para carregar seu cadastro e as provas disponiveis.
          </p>
        </div>
      </header>

      {params.erro ? (
        <div className="mt-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-4 py-3 text-sm text-[#b00018]">
          {params.erro}
        </div>
      ) : null}

      <section className="mt-4">
        {activeApplicationCount > 0 ? (
          <StudentEntry />
        ) : (
          <div className="rounded-lg border border-[#d8def0] bg-white p-6 text-sm text-[#5d6480]">
            Nenhuma prova ativa no momento.
          </div>
        )}
      </section>
    </main>
  );
}
