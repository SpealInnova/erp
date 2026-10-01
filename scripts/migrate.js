require("dotenv").config();
const { crearPool } = require("../src/config/db");
const { ejecutarMigraciones } = require("../src/migrador");

async function main() {
  const pool = crearPool();
  try {
    await ejecutarMigraciones(pool);
    console.log("Migraciones al día.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Error en migración:", error);
  process.exit(1);
});
