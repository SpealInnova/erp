// Tablas con versiones. El nombre de la tabla nunca viene del usuario sin
// pasar por esta lista (se interpola en el UPDATE de fijarVersion).
const TABLAS_VERSIONADAS = [
  "proyectos",
  "cotizaciones",
  "ordenes_compra",
  "actas_entrega_equipos",
  "actas_cierre_satisfaccion",
  "reportes_servicio_tecnico",
];

function exigirTabla(tabla) {
  if (!TABLAS_VERSIONADAS.includes(tabla)) {
    throw new Error(`Tabla sin versiones: ${tabla}`);
  }
}

async function registrar(conexion, { tabla, registroId, version, instantanea, motivo, usuarioId }) {
  exigirTabla(tabla);
  await conexion.query(
    `INSERT INTO documento_versiones (tabla, registro_id, version, instantanea, motivo, reemplazada_por)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tabla, registroId, version, JSON.stringify(instantanea), motivo, usuarioId || null]
  );
}

async function fijarVersion(conexion, tabla, registroId, version) {
  exigirTabla(tabla);
  await conexion.query(`UPDATE ${tabla} SET version = ? WHERE id = ?`, [version, registroId]);
}

async function listar(pool, tabla, registroId) {
  exigirTabla(tabla);
  const [filas] = await pool.query(
    `SELECT v.version, v.motivo, v.instantanea, v.reemplazada_en, u.nombre AS reemplazada_por
     FROM documento_versiones v
     LEFT JOIN usuarios u ON u.id = v.reemplazada_por
     WHERE v.tabla = ? AND v.registro_id = ?
     ORDER BY v.version DESC`,
    [tabla, registroId]
  );
  return filas.map((f) => ({
    ...f,
    instantanea: typeof f.instantanea === "string" ? JSON.parse(f.instantanea) : f.instantanea,
  }));
}

async function versionVigente(pool, tabla, registroId) {
  exigirTabla(tabla);
  const [filas] = await pool.query(
    `SELECT version FROM ${tabla} WHERE id = ? AND deleted_at IS NULL`,
    [registroId]
  );
  return filas[0] ? Number(filas[0].version) : null;
}

module.exports = { TABLAS_VERSIONADAS, registrar, fijarVersion, listar, versionVigente };
