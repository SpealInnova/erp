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
    await pool.query("DELETE FROM documento_versiones WHERE reemplazada_por IN (?)", [idsUsuarios]);
    // Compras creadas por las pruebas (p. ej. la aprobación de OC del tablero):
    // se borran antes que los proyectos por las llaves foráneas.
    const proyectosE2E = `SELECT id FROM proyectos WHERE responsable_id IN (?) OR nombre_proyecto LIKE ?`;
    const parametrosE2E = [idsUsuarios, `${PREFIJO_DATOS_E2E}%`];
    await pool.query(
      `DELETE oci FROM orden_compra_items oci
       JOIN ordenes_compra oc ON oc.id = oci.orden_compra_id
       JOIN requisiciones r ON r.id = oc.requisicion_id
       WHERE r.proyecto_id IN (${proyectosE2E})`,
      parametrosE2E
    );
    await pool.query(
      `DELETE oc FROM ordenes_compra oc
       JOIN requisiciones r ON r.id = oc.requisicion_id
       WHERE r.proyecto_id IN (${proyectosE2E})`,
      parametrosE2E
    );
    await pool.query(
      `DELETE ri FROM requisicion_items ri
       JOIN requisiciones r ON r.id = ri.requisicion_id
       WHERE r.proyecto_id IN (${proyectosE2E})`,
      parametrosE2E
    );
    await pool.query(
      `DELETE FROM requisiciones WHERE proyecto_id IN (${proyectosE2E})`,
      parametrosE2E
    );
    // Equipos y reportes de servicio de las pruebas (dependen de proyectos y clientes).
    await pool.query(
      `DELETE FROM reportes_servicio_tecnico
       WHERE created_by IN (?) OR proyecto_id IN (${proyectosE2E})`,
      [idsUsuarios, ...parametrosE2E]
    );
    await pool.query(
      `DELETE FROM equipos WHERE created_by IN (?) OR proyecto_id IN (${proyectosE2E})`,
      [idsUsuarios, ...parametrosE2E]
    );
    await pool.query("DELETE FROM proveedores WHERE created_by IN (?) OR razon_social LIKE ?", [
      idsUsuarios,
      `${PREFIJO_DATOS_E2E}%`,
    ]);
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
