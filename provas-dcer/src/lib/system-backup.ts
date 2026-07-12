import { execFile } from "child_process";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const backupPrefix = "provas-dcer-system-";
const uploadedBackupPrefix = "provas-dcer-system-uploaded-";
const backupExtension = ".tar.gz";

type BackupManifest = {
  version: 1;
  createdAt: string;
  appName: string;
  appVersion: string;
  nodeEnv: string;
  includes: string[];
  requestedBy?: string | null;
};

export type SystemBackupInfo = {
  fileName: string;
  path: string;
  size: number;
  createdAt: Date;
};

export type RestoreSystemBackupOptions = {
  restoreDatabase: boolean;
  restoreApplication: boolean;
};

export type RestoreSystemBackupResult = {
  manifest: BackupManifest;
  restoredDatabase: boolean;
  applicationRestorePath: string | null;
};

function run(command: string, args: string[], cwd?: string) {
  return execFileAsync(command, args, {
    cwd,
    env: process.env,
    maxBuffer: 1024 * 1024 * 20,
  });
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function randomSuffix() {
  return randomBytes(4).toString("hex");
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL nao esta configurada.");
  }

  return databaseUrl;
}

function getPostgresToolConnection() {
  const databaseUrl = getDatabaseUrl();

  try {
    const url = new URL(databaseUrl);
    const schema = url.searchParams.get("schema");
    url.searchParams.delete("schema");

    return {
      databaseUrl: url.toString(),
      schema,
    };
  } catch {
    return {
      databaseUrl,
      schema: null,
    };
  }
}

export function getSystemBackupDir() {
  return process.env.SYSTEM_BACKUP_DIR || path.join(os.tmpdir(), "provas-dcer-system-backups");
}

export function getSystemRestoreDir() {
  return process.env.SYSTEM_RESTORE_DIR || path.join(/*turbopackIgnore: true*/ getSystemBackupDir(), "restores");
}

export function getSystemAppRoot() {
  return process.env.SYSTEM_APP_ROOT || "/app";
}

function isPathInside(childPath: string, parentPath: string) {
  const relative = path.relative(parentPath, childPath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function normalizeArchiveName(fileName: string) {
  return fileName.trim();
}

function assertSafeArchiveName(fileName: string) {
  const normalized = normalizeArchiveName(fileName);

  if (
    !normalized.endsWith(backupExtension) ||
    (!normalized.startsWith(backupPrefix) && !normalized.startsWith(uploadedBackupPrefix)) ||
    !/^[a-zA-Z0-9._-]+$/.test(normalized)
  ) {
    throw new Error("Arquivo de backup invalido.");
  }

  return normalized;
}

export async function ensureSystemBackupDir() {
  const backupDir = getSystemBackupDir();
  await fs.mkdir(backupDir, { recursive: true });
  await fs.mkdir(getSystemRestoreDir(), { recursive: true });
  return backupDir;
}

export async function resolveSystemBackupArchive(fileName: string) {
  const safeFileName = assertSafeArchiveName(fileName);
  const backupDir = path.resolve(/*turbopackIgnore: true*/ await ensureSystemBackupDir());
  const archivePath = path.resolve(/*turbopackIgnore: true*/ backupDir, safeFileName);

  if (!isPathInside(archivePath, backupDir)) {
    throw new Error("Arquivo de backup invalido.");
  }

  const stat = await fs.stat(archivePath);

  if (!stat.isFile()) {
    throw new Error("Backup nao encontrado.");
  }

  return archivePath;
}

async function readPackageInfo() {
  try {
    const raw = await fs.readFile(path.join(/*turbopackIgnore: true*/ getSystemAppRoot(), "package.json"), "utf8");
    const data = JSON.parse(raw) as { name?: string; version?: string };
    return {
      name: data.name || "provas-dcer",
      version: data.version || "0.0.0",
    };
  } catch {
    return {
      name: "provas-dcer",
      version: "0.0.0",
    };
  }
}

function getAppTarExcludes() {
  const cwd = path.resolve(/*turbopackIgnore: true*/ getSystemAppRoot());
  const backupDir = path.resolve(/*turbopackIgnore: true*/ getSystemBackupDir());
  const restoreDir = path.resolve(/*turbopackIgnore: true*/ getSystemRestoreDir());
  const excludes = [
    "--exclude=node_modules",
    "--exclude=.git",
    "--exclude=.next/cache",
    "--exclude=tmp",
    "--exclude=*.log",
  ];

  for (const dir of [backupDir, restoreDir]) {
    if (isPathInside(dir, cwd)) {
      excludes.push(`--exclude=${path.relative(cwd, dir).replace(/\\/g, "/")}`);
    }
  }

  return excludes;
}

export async function listSystemBackups(): Promise<SystemBackupInfo[]> {
  const backupDir = await ensureSystemBackupDir();
  const entries = await fs.readdir(backupDir, { withFileTypes: true });
  const backups = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(backupExtension))
      .filter((entry) => entry.name.startsWith(backupPrefix) || entry.name.startsWith(uploadedBackupPrefix))
      .map(async (entry) => {
        const filePath = path.join(/*turbopackIgnore: true*/ backupDir, entry.name);
        const stat = await fs.stat(filePath);
        return {
          fileName: entry.name,
          path: filePath,
          size: stat.size,
          createdAt: stat.mtime,
        };
      }),
  );

  return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createSystemBackupArchive(requestedBy?: string | null): Promise<SystemBackupInfo> {
  const backupDir = await ensureSystemBackupDir();
  const createdAt = new Date();
  const packageInfo = await readPackageInfo();
  const tempDir = await fs.mkdtemp(path.join(/*turbopackIgnore: true*/ os.tmpdir(), "provas-dcer-backup-"));
  const payloadDir = path.join(/*turbopackIgnore: true*/ tempDir, "payload");
  const databaseDumpPath = path.join(/*turbopackIgnore: true*/ payloadDir, "database.dump");
  const applicationArchivePath = path.join(/*turbopackIgnore: true*/ payloadDir, "application.tar.gz");
  const appRoot = path.resolve(/*turbopackIgnore: true*/ getSystemAppRoot());
  const fileName = `${backupPrefix}${timestampForFile(createdAt)}-${randomSuffix()}${backupExtension}`;
  const archivePath = path.join(/*turbopackIgnore: true*/ backupDir, fileName);

  try {
    await fs.mkdir(payloadDir, { recursive: true });

    const manifest: BackupManifest = {
      version: 1,
      createdAt: createdAt.toISOString(),
      appName: packageInfo.name,
      appVersion: packageInfo.version,
      nodeEnv: process.env.NODE_ENV || "development",
      includes: ["database.dump", "application.tar.gz"],
      requestedBy,
    };

    const connection = getPostgresToolConnection();
    const schemaArgs = connection.schema ? ["--schema", connection.schema] : [];

    await run("pg_dump", [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      ...schemaArgs,
      "--dbname",
      connection.databaseUrl,
      "--file",
      databaseDumpPath,
    ]);

    await run("tar", ["-czf", applicationArchivePath, ...getAppTarExcludes(), "-C", appRoot, "."]);

    await fs.writeFile(
      path.join(/*turbopackIgnore: true*/ payloadDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    await fs.writeFile(
      path.join(/*turbopackIgnore: true*/ payloadDir, "README_RESTORE.txt"),
      [
        "Backup completo do Provas DCER.",
        "",
        "Conteudo:",
        "- database.dump: dump PostgreSQL em formato custom.",
        "- application.tar.gz: snapshot dos arquivos da aplicacao.",
        "",
        "Este arquivo contem dados sensiveis e deve ser guardado com acesso restrito.",
        "",
      ].join("\n"),
      "utf8",
    );

    await run("tar", ["-czf", archivePath, "-C", payloadDir, "."]);

    const stat = await fs.stat(archivePath);
    return {
      fileName,
      path: archivePath,
      size: stat.size,
      createdAt,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function saveUploadedSystemBackup(file: File) {
  const backupDir = await ensureSystemBackupDir();

  if (!file || file.size === 0) {
    throw new Error("Selecione um arquivo de backup.");
  }

  const fileName = `${uploadedBackupPrefix}${timestampForFile()}-${randomSuffix()}${backupExtension}`;
  const archivePath = path.join(/*turbopackIgnore: true*/ backupDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await fs.writeFile(archivePath, buffer, { flag: "wx" });

  return archivePath;
}

async function readManifest(extractDir: string) {
  const manifestPath = path.join(/*turbopackIgnore: true*/ extractDir, "manifest.json");
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw) as BackupManifest;

  if (manifest.version !== 1 || !manifest.includes?.includes("database.dump")) {
    throw new Error("Manifesto do backup invalido.");
  }

  return manifest;
}

export async function restoreSystemBackupArchive(
  archivePath: string,
  options: RestoreSystemBackupOptions,
): Promise<RestoreSystemBackupResult> {
  if (!options.restoreDatabase && !options.restoreApplication) {
    throw new Error("Selecione pelo menos um item para restaurar.");
  }

  const extractDir = await fs.mkdtemp(path.join(/*turbopackIgnore: true*/ os.tmpdir(), "provas-dcer-restore-"));

  try {
    await run("tar", ["-xzf", archivePath, "-C", extractDir]);

    const manifest = await readManifest(extractDir);
    const databaseDumpPath = path.join(/*turbopackIgnore: true*/ extractDir, "database.dump");
    const applicationArchivePath = path.join(/*turbopackIgnore: true*/ extractDir, "application.tar.gz");

    if (options.restoreDatabase) {
      await fs.access(databaseDumpPath);
    }

    if (options.restoreApplication) {
      await fs.access(applicationArchivePath);
    }

    let applicationRestorePath: string | null = null;

    if (options.restoreApplication) {
      const restoreDir = getSystemRestoreDir();
      applicationRestorePath = path.join(
        /*turbopackIgnore: true*/
        restoreDir,
        `application-${timestampForFile(new Date(manifest.createdAt))}-${randomSuffix()}`,
      );
      await fs.mkdir(applicationRestorePath, { recursive: true });
      await run("tar", ["-xzf", applicationArchivePath, "-C", applicationRestorePath]);
    }

    if (options.restoreDatabase) {
      const connection = getPostgresToolConnection();
      await run("pg_restore", [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--single-transaction",
        "--exit-on-error",
        "--dbname",
        connection.databaseUrl,
        databaseDumpPath,
      ]);
    }

    return {
      manifest,
      restoredDatabase: options.restoreDatabase,
      applicationRestorePath,
    };
  } finally {
    await fs.rm(extractDir, { recursive: true, force: true });
  }
}
