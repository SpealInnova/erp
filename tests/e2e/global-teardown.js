const { crearPool } = require("../../src/config/db");
const { USUARIO_PRINCIPAL, USUARIO_COLEGA, PREFIJO_DATOS_E2E } = require("./fixtures");

module.exports = async function globalTeardown() {
  const pool = crearPool();
  try {
    const [usuarios] = await pool.query("SELECT id FROM usuarios WHERE correo IN (?, ?)", [
      USUARIO_PRINCIPAL.correo,
      USUARIO_COLEGA.correo,
    ]);
    const idsUsuarios = usuarios.map((u) => u.id);
    if (idsUsuarios.length === 0) return;

    await pool.query("DELETE FROM notificaciones WHERE usuario_id IN (?)", [idsUsuarios]);
    await pool.query("DELETE FROM proyecto_equipo WHERE usuario_id IN (?)", [idsUsuarios]);
    await pool.query("DELETE FROM auditoria WHERE usuario_id IN (?)", [idsUsuarios]);
    await pool.query(
      `DELETE pa FROM proyecto_actividades pa
       JOIN proyectos p ON p.id = pa.proyecto_id
       WHERE p.responsable_id IN (?) OR p.nombre_proyecto LIKE ?`,
      [idsUsuarios, `${PREFIJO_DATOS_E2E}%`]
    );
    await pool.query(
      "DELETE FROM proyectos WHERE responsable_id IN (?) OR nombre_proyecto LIKE ?",
      [idsUsuarios, `${PREFIJO_DATOS_E2E}%`]
    );
    await pool.query("DELETE FROM clientes WHERE created_by IN (?) OR nombre_razon_social LIKE ?", [
      idsUsuarios,
      `${PREFIJO_DATOS_E2E}%`,
    ]);
    await pool.query("DELETE FROM usuarios WHERE id IN (?)", [idsUsuarios]);
  } finally {
    await pool.end();
  }
};
