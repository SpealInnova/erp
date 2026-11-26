async function crear(pool, proyectoId, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO proyecto_actividades
      (proyecto_id, fase, categoria, descripcion, orden, origen, responsable_id, estado, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      proyectoId,
      datos.fase,
      datos.categoria,
      datos.descripcion,
      datos.orden || 0,
      datos.origen || "plantilla",
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

// Las de plantilla primero, en su orden; las agregadas a mano después (aunque
// se hayan agregado antes de que la fase recibiera su plantilla).
async function listarPorProyecto(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT * FROM proyecto_actividades WHERE proyecto_id = ? AND deleted_at IS NULL
     ORDER BY origen = 'manual', orden, id`,
    [proyectoId]
  );
  return filas;
}

// Actividades de plantilla ya sembradas en la fase. Las agregadas a mano
// (origen 'manual') no cuentan: no impiden que la fase reciba su plantilla.
async function contarPlantillaPorProyectoYFase(pool, proyectoId, fase) {
  const [filas] = await pool.query(
    `SELECT COUNT(*) AS total FROM proyecto_actividades
     WHERE proyecto_id = ? AND fase = ? AND origen = 'plantilla' AND deleted_at IS NULL`,
    [proyectoId, fase]
  );
  return Number(filas[0].total);
}

// Siguiente posición en la fase: una actividad agregada a mano va al final.
async function siguienteOrden(pool, proyectoId, fase) {
  const [filas] = await pool.query(
    `SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM proyecto_actividades
     WHERE proyecto_id = ? AND fase = ? AND deleted_at IS NULL`,
    [proyectoId, fase]
  );
  return Number(filas[0].siguiente);
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
// "Pendiente" para el usuario: todo lo no finalizado (pendiente o en curso).
const CONDICION_PENDIENTE = `a.deleted_at IS NULL AND a.estado <> 'completada'
   AND p.deleted_at IS NULL AND p.estado NOT IN ('cerrado', 'cancelado')`;

async function listarPendientesDeUsuario(pool, usuarioId) {
  const [filas] = await pool.query(
    `SELECT a.id, a.proyecto_id, a.fase, a.categoria, a.descripcion, a.estado, a.prioridad, a.fecha_inicio,
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

// { fase: cantidad } de evidencias (archivos adjuntos vigentes) de las
// actividades de un proyecto.
async function contarEvidenciasPorFase(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT a.fase, COUNT(*) AS n
       FROM archivos_adjuntos aa
       JOIN proyecto_actividades a ON a.id = aa.registro_id
      WHERE aa.tabla = 'proyecto_actividades' AND aa.deleted_at IS NULL
        AND a.proyecto_id = ? AND a.deleted_at IS NULL
      GROUP BY a.fase`,
    [proyectoId]
  );
  return Object.fromEntries(filas.map((f) => [f.fase, Number(f.n)]));
}

// Responsables de las actividades de una fase (personas vinculadas a la fase).
async function listarResponsablesDeFase(pool, proyectoId, fase) {
  const [filas] = await pool.query(
    `SELECT DISTINCT responsable_id FROM proyecto_actividades
      WHERE proyecto_id = ? AND fase = ? AND deleted_at IS NULL AND responsable_id IS NOT NULL`,
    [proyectoId, fase]
  );
  return filas.map((f) => f.responsable_id);
}

module.exports = {
  contarEvidenciasPorFase,
  listarResponsablesDeFase,
  listarPendientesDeUsuario,
  listarParaAviso,
  crear,
  crearMuchas,
  obtenerPorId,
  listarPorProyecto,
  contarPlantillaPorProyectoYFase,
  siguienteOrden,
  actualizar,
  softDelete,
};
