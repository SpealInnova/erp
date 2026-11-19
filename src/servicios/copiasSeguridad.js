const zlib = require("zlib");
const { escape, escapeId } = require("mysql2");
const repo = require("../repositorios/copiasSeguridadRepositorio");
const auditoria = require("./auditoria");
const archivosDrive = require("./archivosDrive");
const { ErrorCopiaEnCurso } = require("../dominio/erroresCopias");

/* Copias de seguridad del ERP.

   Cada copia es el estado completo de la base de datos (estructura y datos de
   todas las tablas) en un archivo .sql comprimido (.sql.gz) que se sube a la
   carpeta de copias en Google Drive (DRIVE_COPIAS_FOLDER_ID o, si no está,
   DRIVE_FOLDER_ID). Las evidencias ya viven en Drive, así que con la base
   queda todo el ERP. Cada intento queda en la tabla copias_seguridad.

   - Diaria y automática solo si COPIAS_DIARIAS=1 (producción). Se hace una
     vez al día a partir de la hora COPIAS_HORA (por defecto las 2), y si
     falla se reintenta en la siguiente revisión, hasta 3 veces al día.
   - Manual desde el panel de copias (admin y Gerente General).
   - Para restaurar: descomprimir el .sql.gz e importarlo en una base vacía
     (phpMyAdmin → Importar). Ver docs/COPIAS_DE_SEGURIDAD.md.
   Usa el mismo token de Google que el correo y las evidencias: necesita el
   permiso de Drive (drive.file). Un agente nunca debe ver ese token. */

const FILAS_POR_INSERT = 200;
const UNA_HORA_MS = 60 * 60 * 1000;
const MAXIMO_FALLIDAS_POR_DIA = 3;

// Fechas, horas, decimales y JSON se copian tal como están en la base (texto),
// sin pasar por la zona horaria ni por números de JavaScript.
const TIPOS_COMO_TEXTO = new Set(["DATE", "DATETIME", "TIMESTAMP", "TIME", "NEWDECIMAL", "JSON"]);
function comoTexto(campo, siguiente) {
  return TIPOS_COMO_TEXTO.has(campo.type) ? campo.string() : siguiente();
}

function valorSql(valor) {
  if (valor !== null && typeof valor === "object" && !Buffer.isBuffer(valor)) {
    return escape(JSON.stringify(valor));
  }
  return escape(valor);
}

function dosDigitos(n) {
  return String(n).padStart(2, "0");
}

function nombreArchivo(baseDeDatos, fecha) {
  const dia = `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
  const hora = `${dosDigitos(fecha.getHours())}${dosDigitos(fecha.getMinutes())}`;
  return `copia-erp-${baseDeDatos}-${dia}_${hora}.sql.gz`;
}

// Volcado SQL de toda la base: DROP + CREATE de cada tabla y sus filas en
// INSERT por lotes. Se restaura importándolo en una base vacía.
async function volcarBaseDeDatos(pool, { ahora = new Date() } = {}) {
  const [[{ base }]] = await pool.query("SELECT DATABASE() AS base");
  const [filasTablas] = await pool.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tablas = filasTablas.map((f) => f[Object.keys(f)[0]]).sort();
  const partes = [
    "-- Copia de seguridad de SPEAL Project Control (ERP)",
    `-- Base de datos: ${base}`,
    `-- Fecha: ${ahora.toISOString()}`,
    "-- Restaurar: importar este archivo (descomprimido) en una base vacía.",
    "SET NAMES utf8mb4;",
    "SET FOREIGN_KEY_CHECKS = 0;",
    "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';",
    "",
  ];
  let registros = 0;
  for (const tabla of tablas) {
    const [[definicion]] = await pool.query(`SHOW CREATE TABLE ${escapeId(tabla)}`);
    partes.push(`DROP TABLE IF EXISTS ${escapeId(tabla)};`, `${definicion["Create Table"]};`, "");
    const [filas] = await pool.query({
      sql: `SELECT * FROM ${escapeId(tabla)}`,
      typeCast: comoTexto,
    });
    if (filas.length) {
      const columnas = Object.keys(filas[0])
        .map((c) => escapeId(c))
        .join(", ");
      for (let i = 0; i < filas.length; i += FILAS_POR_INSERT) {
        const valores = filas
          .slice(i, i + FILAS_POR_INSERT)
          .map((fila) => `(${Object.values(fila).map(valorSql).join(", ")})`)
          .join(",\n");
        partes.push(`INSERT INTO ${escapeId(tabla)} (${columnas}) VALUES\n${valores};`);
      }
      partes.push("");
      registros += filas.length;
    }
  }
  partes.push("SET FOREIGN_KEY_CHECKS = 1;", "");
  return { base, sql: partes.join("\n"), tablas: tablas.length, registros };
}

function driveConfigurado() {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN &&
    (process.env.DRIVE_COPIAS_FOLDER_ID || process.env.DRIVE_FOLDER_ID)
  );
}

// Nombre del bloqueo por base: staging y producción comparten servidor MySQL.
async function nombreBloqueo(pool) {
  const [[{ base }]] = await pool.query("SELECT DATABASE() AS base");
  return `copia_erp_${base}`.slice(0, 64);
}

// Hace una copia y la registra. Devuelve el registro (exitosa o fallida); solo
// lanza error si ya hay otra copia en curso.
async function hacerCopia(pool, { origen = "manual", usuarioId = null, ahora = new Date() } = {}) {
  const conexion = await pool.getConnection();
  const bloqueo = await nombreBloqueo(pool);
  try {
    const [[{ libre }]] = await conexion.query("SELECT GET_LOCK(?, 0) AS libre", [bloqueo]);
    if (!libre) throw new ErrorCopiaEnCurso();
    try {
      await repo.cerrarInterrumpidas(pool);
      const id = await repo.crear(pool, { origen, solicitadaPor: usuarioId });
      try {
        if (!driveConfigurado()) {
          throw new Error(
            "Google Drive no está configurado: falta el token con permiso de Drive (drive.file) o la carpeta (DRIVE_COPIAS_FOLDER_ID / DRIVE_FOLDER_ID)."
          );
        }
        const volcado = await volcarBaseDeDatos(pool, { ahora });
        const comprimido = zlib.gzipSync(Buffer.from(volcado.sql, "utf8"));
        const nombre = nombreArchivo(volcado.base, ahora);
        const subido = await archivosDrive.subirArchivo({
          nombre,
          mimeType: "application/gzip",
          buffer: comprimido,
          parentId: process.env.DRIVE_COPIAS_FOLDER_ID || process.env.DRIVE_FOLDER_ID,
        });
        await repo.terminar(pool, id, {
          resultado: "exitosa",
          tablas: volcado.tablas,
          registros: volcado.registros,
          tamano_bytes: comprimido.length,
          archivo_nombre: nombre,
          drive_archivo_id: subido.driveFileId,
          drive_enlace: subido.driveEnlace || null,
        });
      } catch (error) {
        await repo.terminar(pool, id, {
          resultado: "fallida",
          error: String(error.message || error).slice(0, 1000),
        });
      }
      const copia = await repo.obtenerPorId(pool, id);
      if (usuarioId) {
        await auditoria.registrar(pool, {
          tabla: "copias_seguridad",
          registroId: id,
          accion: "crear",
          usuarioId,
          datosAnteriores: null,
          datosNuevos: copia,
        });
      }
      return copia;
    } finally {
      await conexion.query("SELECT RELEASE_LOCK(?)", [bloqueo]);
    }
  } finally {
    conexion.release();
  }
}

async function listarCopias(pool) {
  return {
    copias: await repo.listarRecientes(pool),
    configuracion: {
      diarias: process.env.COPIAS_DIARIAS === "1",
      hora: horaDeCopia(),
      drive_configurado: driveConfigurado(),
    },
  };
}

function horaDeCopia() {
  const hora = Number(process.env.COPIAS_HORA);
  return Number.isInteger(hora) && hora >= 0 && hora <= 23 ? hora : 2;
}

// ¿Toca la copia automática? Desde la hora fijada, si hoy no hay una exitosa
// y no se agotaron los reintentos.
async function tocaCopiaDiaria(pool, ahora = new Date()) {
  if (ahora.getHours() < horaDeCopia()) return false;
  const hoy = await repo.resumenDeHoy(pool);
  return hoy.exitosas === 0 && hoy.fallidasAutomaticas < MAXIMO_FALLIDAS_POR_DIA;
}

// Revisión cada hora (la llama index.js). Solo con COPIAS_DIARIAS=1.
function programarCopias(pool, { cadaMs = UNA_HORA_MS, retrasoInicialMs = 60000 } = {}) {
  if (process.env.COPIAS_DIARIAS !== "1") return () => {};
  const revisar = async () => {
    try {
      if (!(await tocaCopiaDiaria(pool))) return;
      const copia = await hacerCopia(pool, { origen: "automatica" });
      if (copia.resultado === "exitosa") {
        console.log(`Copia de seguridad diaria lista: ${copia.archivo_nombre}`);
      } else {
        console.error(`La copia de seguridad diaria falló: ${copia.error}`);
      }
    } catch (error) {
      if (!(error instanceof ErrorCopiaEnCurso)) {
        console.error("No se pudo revisar la copia de seguridad diaria:", error.message);
      }
    }
  };
  const inicial = setTimeout(revisar, retrasoInicialMs);
  const periodico = setInterval(revisar, cadaMs);
  inicial.unref();
  periodico.unref();
  return () => {
    clearTimeout(inicial);
    clearInterval(periodico);
  };
}

module.exports = {
  volcarBaseDeDatos,
  hacerCopia,
  listarCopias,
  tocaCopiaDiaria,
  programarCopias,
  nombreArchivo,
};
