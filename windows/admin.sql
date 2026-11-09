INSERT INTO "AdminUser" (id, name, email, "passwordHash", role, active, "createdAt", "updatedAt")
SELECT 'win-' || md5(random()::text || clock_timestamp()::text), :'admin_name', :'admin_email', :'admin_hash', 'ADMIN', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "AdminUser" WHERE role IN ('ADMIN', 'ADMIN_TEACHER'));
