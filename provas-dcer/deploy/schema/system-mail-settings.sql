CREATE TABLE IF NOT EXISTS "SystemMailSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "host" TEXT NOT NULL DEFAULT '',
    "port" INTEGER NOT NULL DEFAULT 587,
    "security" TEXT NOT NULL DEFAULT 'STARTTLS',
    "useAuth" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT NOT NULL DEFAULT '',
    "passwordEncrypted" TEXT,
    "fromName" TEXT NOT NULL DEFAULT 'Provas DCER Paulista',
    "fromEmail" TEXT NOT NULL DEFAULT '',
    "appUrl" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemMailSettings_pkey" PRIMARY KEY ("id")
);
