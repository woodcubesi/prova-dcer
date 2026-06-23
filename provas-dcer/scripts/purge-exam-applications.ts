import "dotenv/config";
import { purgeDueExamApplications } from "@/lib/exam-application-retention";
import { prisma } from "@/lib/prisma";

async function main() {
  const deletedCount = await purgeDueExamApplications();
  console.log(`Aplicacoes de prova eliminadas: ${deletedCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
