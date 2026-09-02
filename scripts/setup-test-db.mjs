/**
 * Prepara la base de datos de tests.
 *
 * Crea `paki_test` si no existe y le aplica todas las migraciones.
 * Los tests de integración nunca tocan la base de desarrollo.
 */
import { execSync } from "node:child_process";

const TEST_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/paki_test?schema=public";

if (!/paki_test/.test(TEST_URL)) {
  console.error(
    "TEST_DATABASE_URL debe apuntar a una base de test (nombre con 'paki_test'). Abortado.",
  );
  process.exit(1);
}

const dbName = new URL(TEST_URL).pathname.slice(1);

function run(command, options = {}) {
  return execSync(command, { stdio: "inherit", ...options });
}

try {
  // La base puede existir ya: el error de duplicado no es fatal.
  try {
    run(`docker exec paki-postgres psql -U postgres -c "CREATE DATABASE ${dbName};"`, {
      stdio: "pipe",
    });
    console.log(`Base "${dbName}" creada.`);
  } catch {
    console.log(`Base "${dbName}" ya existía.`);
  }

  run("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_URL, DIRECT_URL: TEST_URL },
  });

  console.log("\nBase de tests lista.");
} catch (error) {
  console.error("\nNo se pudo preparar la base de tests.");
  console.error("Verificá que PostgreSQL esté corriendo (npm run db:up).");
  console.error(error.message);
  process.exit(1);
}
