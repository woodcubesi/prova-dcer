import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Category, ExamStatus, PrismaClient, QuestionType } from "../src/generated/prisma/client";
import { normalizeName } from "../src/lib/text";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const churches = [
  {
    name: "Igreja Sede Central",
    embassyName: "Pastor Sergio Medeiros",
    city: "Paulista",
    students: [
      {
        name: "Ana Clara Souza",
        category: Category.JUNIOR,
        externalId: "210300100049",
        registrationIssuedAt: new Date("2019-03-25T00:00:00.000Z"),
        registrationExpiresAt: new Date("2028-12-05T00:00:00.000Z"),
        birthDate: new Date("2010-12-06T00:00:00.000Z"),
        embassyAdmissionDate: new Date("2018-12-06T00:00:00.000Z"),
      },
      { name: "Lucas Gabriel Lima", category: Category.JUNIOR, externalId: "210300100050" },
      { name: "Beatriz Santos", category: Category.ADOLESCENTES, externalId: "210300100051" },
      { name: "Mateus Oliveira", category: Category.JUVENIL, externalId: "210300100052" },
    ],
  },
  {
    name: "Igreja Jardim Paulista",
    embassyName: "Embaixada Jardim Paulista",
    city: "Paulista",
    students: [
      { name: "Maria Eduarda Silva", category: Category.JUNIOR, externalId: "210300100053" },
      { name: "Pedro Henrique Costa", category: Category.ADOLESCENTES, externalId: "210300100054" },
      { name: "Julia Ferreira", category: Category.ADOLESCENTES, externalId: "210300100055" },
      { name: "Rafael Almeida", category: Category.JUVENIL, externalId: "210300100056" },
    ],
  },
  {
    name: "Igreja Vila Esperanca",
    embassyName: "Embaixada Vila Esperanca",
    city: "Paulista",
    students: [
      { name: "Davi Rocha", category: Category.JUNIOR, externalId: "210300100057" },
      { name: "Sofia Martins", category: Category.ADOLESCENTES, externalId: "210300100058" },
      { name: "Gabriel Nascimento", category: Category.JUVENIL, externalId: "210300100059" },
    ],
  },
];

async function main() {
  await prisma.answer.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.applicationParticipant.deleteMany();
  await prisma.examApplication.deleteMany();
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.student.deleteMany();
  await prisma.church.deleteMany();

  const createdChurches = [];

  for (const church of churches) {
    const createdChurch = await prisma.church.create({
      data: {
        name: church.name,
        embassyName: church.embassyName,
        city: church.city,
        students: {
          create: church.students.map((student) => ({
            name: student.name,
            normalizedName: normalizeName(student.name),
            category: student.category,
            externalId: student.externalId,
            registrationIssuedAt: student.registrationIssuedAt,
            registrationExpiresAt: student.registrationExpiresAt,
            birthDate: student.birthDate,
            embassyAdmissionDate: student.embassyAdmissionDate,
          })),
        },
      },
      include: {
        students: true,
      },
    });

    createdChurches.push(createdChurch);
  }

  const exam = await prisma.exam.create({
    data: {
      title: "Simulado de Conhecimentos Biblicos",
      description: "Prova de demonstracao para validar o fluxo de embaixadores, aplicacao e correcao.",
      durationMinutes: 30,
      status: ExamStatus.PUBLISHED,
      questions: {
        create: [
          {
            position: 1,
            statement: "Quantos livros tem a Biblia na tradicao protestante?",
            type: QuestionType.MULTIPLE_CHOICE,
            points: 1,
            options: {
              create: [
                { position: 1, label: "A", text: "39", isCorrect: false },
                { position: 2, label: "B", text: "66", isCorrect: true },
                { position: 3, label: "C", text: "73", isCorrect: false },
                { position: 4, label: "D", text: "80", isCorrect: false },
              ],
            },
          },
          {
            position: 2,
            statement: "Quem construiu a arca, segundo o livro de Genesis?",
            type: QuestionType.MULTIPLE_CHOICE,
            points: 1,
            options: {
              create: [
                { position: 1, label: "A", text: "Moises", isCorrect: false },
                { position: 2, label: "B", text: "Abraao", isCorrect: false },
                { position: 3, label: "C", text: "Noe", isCorrect: true },
                { position: 4, label: "D", text: "Davi", isCorrect: false },
              ],
            },
          },
          {
            position: 3,
            statement: "Qual destes e chamado de evangelho?",
            type: QuestionType.MULTIPLE_CHOICE,
            points: 1,
            options: {
              create: [
                { position: 1, label: "A", text: "Salmos", isCorrect: false },
                { position: 2, label: "B", text: "Mateus", isCorrect: true },
                { position: 3, label: "C", text: "Exodo", isCorrect: false },
                { position: 4, label: "D", text: "Proverbios", isCorrect: false },
              ],
            },
          },
          {
            position: 4,
            statement: "Qual atitude melhor representa servir ao proximo?",
            type: QuestionType.MULTIPLE_CHOICE,
            points: 1,
            options: {
              create: [
                { position: 1, label: "A", text: "Ajudar com humildade e amor", isCorrect: true },
                { position: 2, label: "B", text: "Esperar sempre reconhecimento", isCorrect: false },
                { position: 3, label: "C", text: "Fazer apenas quando houver recompensa", isCorrect: false },
                { position: 4, label: "D", text: "Ignorar a necessidade dos outros", isCorrect: false },
              ],
            },
          },
        ],
      },
    },
  });

  const application = await prisma.examApplication.create({
    data: {
      examId: exam.id,
      title: "Aplicacao demonstrativa",
      accessCode: "DEMO2026",
      active: true,
      endsAt: new Date("2026-12-31T23:59:59.999-03:00"),
      purgeAt: new Date("2027-12-31T23:59:59.999-03:00"),
      showResultToStudent: false,
      participants: {
        create: createdChurches.flatMap((church) =>
          church.students.map((student) => ({
            studentId: student.id,
          })),
        ),
      },
    },
  });

  console.log(`Seed concluido. Aplicacao: ${application.title} (${application.accessCode})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
