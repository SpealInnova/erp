async function crear(pool, proyectoId, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO proyecto_actividades
      (proyecto_id, fase, categoria, descripcion, orden, responsable_id, estado, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      proyectoId,
      datos.fase,
      datos.categoria,
      datos.descripcion,
      datos.orden || 0,
      datos.responsable_id || null,
      datos.estado || "pendiente",
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function crearMuchas(pool, proyectoId, actividades, usuarioId) {
  if (actividades.length === 0) {
    return;
  }
  const valores = actividades.map((actividad) => [
    proyectoId,
    actividad.fase,
    actividad.categoria,
    actividad.descripcion,
    actividad.orden || 0,
    "pendiente",
    usuarioId || null,
  ]);
  await pool.query(
    `INSERT INTO proyecto_actividades
      (proyecto_id, fase, categoria, descripcion, orden, estado, created_by)
     VALUES ?`,
    [valores]
  );
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM proyecto_actividades WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listarPorProyecto(pool, proyectoId) {
  const [filas] = await pool.query(
    "SELECT * FROM proyecto_actividades WHERE proyecto_id = ? AND deleted_at IS NULL ORDER BY orden, id",
    [proyectoId]
  );
  return filas;
}

async function contarPorProyectoYFase(pool, proyectoId, fase) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM proyecto_actividades WHERE proyecto_id = ? AND fase = ? AND deleted_at IS NULL",
    [proyectoId, fase]
  );
  return filas[0].total;
}

async function actualizar(pool, id, datos) {
  const campos = Object.keys(datos);
  if (campos.length === 0) {
    return;
  }
  const asignaciones = campos.map((campo) => `${campo} = ?`).join(", ");
  const valores = campos.map((campo) => datos[campo]);
  await pool.query(`UPDATE proyecto_actividades SET ${asignaciones} WHERE id = ?`, [
    ...valores,
    id,
  ]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE proyecto_actividades SET deleted_at = NOW() WHERE id = ?", [id]);
}

// Lo que se le pide al usuario: las actividades pendientes que tiene
// asignadas y las sin responsable de los proyectos que dirige. No cuenta
// proyectos eliminados, cerrados ni cancelados.
const CONDICION_PENDIENTE = `a.deleted_at IS NULL AND a.estado = 'pendiente'
   AND p.deleted_at IS NULL AND p.estado NOT IN ('cerrado', 'cancelado')`;

async function listarPendientesDeUsuario(pool, usuarioId) {
  const [filas] = await pool.query(
    `SELECT a.id, a.proyecto_id, a.fase, a.categoria, a.descripcion, a.fecha_inicio,
            a.fecha_fin, a.responsable_id, p.codigo_pry, p.nombre_proyecto
       FROM proyecto_actividades a
       JOIN proyectos p ON p.id = a.proyecto_id
      WHERE ${CONDICION_PENDIENTE}
        AND (a.responsable_id = ? OR (a.responsable_id IS NULL AND p.responsable_id = ?))
      ORDER BY a.fecha_fin IS NULL, a.fecha_fin, a.id`,
    [usuarioId, usuarioId]
  );
  return filas;
}

// Pendientes que vencen entre hace diasVencida días y dentro de diasAviso
// días. El aviso va al responsable o, si no tiene, al del proyecto.
async function listarParaAviso(pool, { diasAviso, diasVencida, usuarioId }) {
  const parametros = [diasVencida, diasAviso];
  let filtroUsuario = "";
  if (usuarioId) {
    filtroUsuario = "AND COALESCE(a.responsable_id, p.responsable_id) = ?";
    parametros.push(usuarioId);
  }
  const [filas] = await pool.query(
    `SELECT a.id, a.proyecto_id, a.descripcion, a.fecha_fin, p.codigo_pry,
            COALESCE(a.responsable_id, p.responsable_id) AS destinatario_id,
            DATEDIFF(a.fecha_fin, CURDATE()) AS dias_restantes
       FROM proyecto_actividades a
       JOIN proyectos p ON p.id = a.proyecto_id
      WHERE ${CONDICION_PENDIENTE}
        AND a.fecha_fin BETWEEN CURDATE() - INTERVAL ? DAY AND CURDATE() + INTERVAL ? DAY
        AND COALESCE(a.responsable_id, p.responsable_id) IS NOT NULL
        ${filtroUsuario}
      ORDER BY a.fecha_fin, a.id`,
    parametros
  );
  return filas;
}

module.exports = {
  listarPendientesDeUsuario,
  listarParaAviso,
  crear,
  crearMuchas,
  obtenerPorId,
  listarPorProyecto,
  contarPorProyectoYFase,
  actualizar,
  softDelete,
};
