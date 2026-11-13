// Ensayo de migraciones sobre una COPIA LOCAL de producción, antes de
// desplegar (ver docs/PASO_A_PRODUCCION.md).
//
// 1) Restaura el respaldo de producción en la base local, p. ej.:
//      docker exec -i erp-test-db mariadb -uroot -proot -e "CREATE DATABASE erp_prod_ensayo"
//      docker exec -i erp-test-db mariadb -uroot -proot erp_prod_ensayo < respaldo.sql
// 2) Corre:  node scripts/ensayo-migraciones.js erp_prod_ensayo
//    (usa DB_USER/DB_PASSWORD/DB_PORT del entorno; por defecto root/root/3307)
// 3) Al terminar, borra la base y el archivo del respaldo.
//
// Solo corre contra localhost: nunca contra la base real de producción.
const mysql = require("mysql2/promise");
const { crearPool } = require("../src/config/db");
const { ejecutarMigraciones } = require("../src/migrador");

const PRECHEQUEOS = [
  {
    titulo: "Reportes sin proyecto que no se pueden completar (045 fallaría)",
    sql: `SELECT r.id, r.numero_reporte, r.equipo_numero_serie
          FROM reportes_servicio_tecnico r
          LEFT JOIN expedientes_diseno e ON e.numero_serie = r.equipo_numero_serie
          WHERE r.proyecto_id IS NULL AND e.id IS NULL`,
  },
  {
    titulo: "Reportes con serial vacío (no pasan al registro de equipos; 043 fallaría)",
    sql: "SELECT id, numero_reporte FROM reportes_servicio_tecnico WHERE equipo_numero_serie = ''",
  },
];

const COMPROBACIONES = [
  ["Migraciones registradas", "SELECT COUNT(*) AS n, MAX(id) AS ultima FROM schema_migrations"],
  ["Equipos en el registro", "SELECT origen, COUNT(*) AS n FROM equipos GROUP BY origen"],
  [
    "Reportes sin proyecto (debe ser 0)",
    "SELECT COUNT(*) AS n FROM reportes_servicio_tecnico WHERE proyecto_id IS NULL",
  ],
  [
    "Reportes cuyo serial no está en el registro (debe ser 0)",
    `SELECT COUNT(*) AS n FROM reportes_servicio_tecnico r
     LEFT JOIN equipos q ON q.numero_serie = r.equipo_numero_serie WHERE q.id IS NULL`,
  ],
];

async function main() {
  const baseDeDatos = process.argv[2];
  const host = process.env.DB_HOST || "127.0.0.1";
  if (!baseDeDatos) {
    throw new Error("Indica la base local con la copia de producción, p. ej. erp_prod_ensayo");
  }
  if (!["127.0.0.1", "localhost"].includes(host)) {
    throw new Error(`Solo se ensaya contra una base local (DB_HOST=${host})`);
  }
  process.env.DB_HOST = host;
  process.env.DB_PORT = process.env.DB_PORT || "3307";
  process.env.DB_USER = process.env.DB_USER || "root";
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || "root";
  process.env.DB_NAME = baseDeDatos;

  const conexion = await mysql.createConnection({
    host,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: baseDeDatos,
  });
  let bloqueantes = 0;
  try {
    console.log(`Pre-chequeo en ${baseDeDatos}:`);
    for (const { titulo, sql } of PRECHEQUEOS) {
      const [filas] = await conexion.query(sql);
      bloqueantes += filas.length;
      console.log(`  ${filas.length === 0 ? "OK " : "!! "} ${titulo}: ${filas.length}`);
      filas.slice(0, 20).forEach((f) => console.log("      ", JSON.stringify(f)));
    }
    if (bloqueantes > 0) {
      console.log("Hay datos que harían fallar las migraciones: corrígelos antes de desplegar.");
      process.exitCode = 1;
      return;
    }

    const pool = crearPool();
    try {
      await ejecutarMigraciones(pool);
    } finally {
      await pool.end();
    }

    console.log("Después de migrar:");
    for (const [titulo, sql] of COMPROBACIONES) {
      const [filas] = await conexion.query(sql);
      console.log(`  ${titulo}: ${JSON.stringify(filas)}`);
    }
  } finally {
    await conexion.end();
  }
}

main().catch((error) => {
  console.error("El ensayo falló:", error.message);
  process.exit(1);
});
