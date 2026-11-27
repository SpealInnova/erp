const { HOY_COLOMBIA_SQL: HOY } = require("../dominio/fechaColombia");
const COLUMNAS = `t.*, r.nombre AS responsable_nombre, c.nombre AS creador_nombre,
  cl.nombre_razon_social AS cliente_nombre, p.codigo_pry AS proyecto_codigo`;
const DESDE = `FROM tareas t
  JOIN usuarios r ON r.id = t.responsable_id
  JOIN usuarios c ON c.id = t.created_by
  LEFT JOIN clientes cl ON cl.id = t.cliente_id
  LEFT JOIN proyectos p ON p.id = t.proyecto_id`;

// Fin de la ventana de cada periodo (hoy, domingo de esta semana, fin de mes).
const LIMITE_PERIODO = {
  hoy: HOY,
  semana: `${HOY} + INTERVAL (6 - WEEKDAY(${HOY})) DAY`,
  mes: `LAST_DAY(${HOY})`,
};

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO tareas
       (titulo, descripcion, responsable_id, prioridad, fecha_inicio, fecha_fin,
        cliente_id, proyecto_id, documento, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.titulo,
      datos.descripcion || null,
      datos.responsable_id,
      datos.prioridad || "normal",
      datos.fecha_inicio || null,
      datos.fecha_fin || null,
      datos.cliente_id || null,
      datos.proyecto_id || null,
      datos.documento || null,
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS} ${DESDE} WHERE t.id = ? AND t.deleted_at IS NULL`,
    [id]
  );
  return filas[0] || null;
}

// Tareas que le tocan a un usuario: las suyas y las que creó para otros.
async function listarDeUsuario(
  pool,
  usuarioId,
  { periodo = "todas", origen = "todas", estado = "abiertas" } = {}
) {
  const condiciones = ["t.deleted_at IS NULL"];
  const parametros = [];
  if (origen === "propias") {
    condiciones.push("t.created_by = ? AND t.responsable_id = ?");
    parametros.push(usuarioId, usuarioId);
  } else if (origen === "asignadas_por_mi") {
    condiciones.push("t.created_by = ? AND t.responsable_id <> ?");
    parametros.push(usuarioId, usuarioId);
  } else if (origen === "asignadas_a_mi") {
    condiciones.push("t.responsable_id = ? AND t.created_by <> ?");
    parametros.push(usuarioId, usuarioId);
  } else {
    condiciones.push("(t.responsable_id = ? OR t.created_by = ?)");
    parametros.push(usuarioId, usuarioId);
  }
  if (estado === "abiertas") condiciones.push("t.estado <> 'completada'");
  if (estado === "finalizadas") condiciones.push("t.estado = 'completada'");
  if (periodo === "vencidas") {
    condiciones.push(`t.estado <> 'completada' AND t.fecha_fin < ${HOY}`);
  } else if (LIMITE_PERIODO[periodo]) {
    // en la ventana [hoy, límite], vencidas o sin fechas (para no olvidarlas)
    condiciones.push(`((t.fecha_inicio IS NULL AND t.fecha_fin IS NULL)
      OR (t.estado <> 'completada' AND t.fecha_fin < ${HOY})
      OR t.estado = 'en_curso'
      OR (COALESCE(t.fecha_inicio, t.fecha_fin) <= ${LIMITE_PERIODO[periodo]}
          AND COALESCE(t.fecha_fin, t.fecha_inicio) >= ${HOY}))`);
  }
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS} ${DESDE}
      WHERE ${condiciones.join(" AND ")}
      ORDER BY t.estado = 'completada', t.estado = 'en_curso' DESC,
               FIELD(t.prioridad, 'urgente', 'alta', 'normal'),
               t.fecha_fin IS NULL, t.fecha_fin, t.id`,
    parametros
  );
  return filas;
}

async function actualizar(pool, id, datos) {
  const campos = Object.keys(datos);
  if (campos.length === 0) return;
  await pool.query(`UPDATE tareas SET ${campos.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, [
    ...campos.map((c) => datos[c]),
    id,
  ]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE tareas SET deleted_at = NOW() WHERE id = ?", [id]);
}

// Abiertas que vencen entre hace diasVencida días y dentro de diasAviso días
// (avisos de vencimiento); el aviso va al responsable.
async function listarParaAviso(pool, { diasAviso, diasVencida, usuarioId }) {
  const parametros = [diasVencida, diasAviso];
  let filtro = "";
  if (usuarioId) {
    filtro = "AND t.responsable_id = ?";
    parametros.push(usuarioId);
  }
  const [filas] = await pool.query(
    `SELECT t.id, t.titulo, t.fecha_fin, t.responsable_id AS destinatario_id,
            DATEDIFF(t.fecha_fin, ${HOY}) AS dias_restantes
       FROM tareas t
      WHERE t.deleted_at IS NULL AND t.estado <> 'completada'
        AND t.fecha_fin BETWEEN ${HOY} - INTERVAL ? DAY AND ${HOY} + INTERVAL ? DAY
        ${filtro}
      ORDER BY t.fecha_fin, t.id`,
    parametros
  );
  return filas;
}

module.exports = { crear, obtenerPorId, listarDeUsuario, actualizar, softDelete, listarParaAviso };
