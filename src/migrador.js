const fs = require("fs");
const path = require("path");

async function ejecutarMigraciones(pool) {
  const conexion = await pool.getConnection();

  try {
    await conexion.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        aplicado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const carpeta = path.join(__dirname, "..", "migrations");
    const archivos = fs
      .readdirSync(carpeta)
      .filter((nombre) => nombre.endsWith(".sql"))
      .sort();

    const [aplicadas] = await conexion.query("SELECT id FROM schema_migrations");
    const idsAplicados = new Set(aplicadas.map((fila) => fila.id));

    for (const archivo of archivos) {
      if (idsAplicados.has(archivo)) {
        continue;
      }
      const sql = fs.readFileSync(path.join(carpeta, archivo), "utf8");
      console.log(`Aplicando migración: ${archivo}`);
      await conexion.query(sql);
      await conexion.query("INSERT INTO schema_migrations (id) VALUES (?)", [archivo]);
    }
  } finally {
    conexion.release();
  }
}

module.exports = { ejecutarMigraciones };
