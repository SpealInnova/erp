const { listarPaginado } = require("./consultaListado");

const COLUMNAS_LISTADO = `
  q.id, q.numero_serie, q.cliente_id, q.proyecto_id, q.expediente_id, q.descripcion,
  q.marca, q.modelo, q.origen,
  DATE_FORMAT(q.fecha_instalacion, '%Y-%m-%d') AS fecha_instalacion,
  c.nombre_razon_social AS cliente, p.codigo_pry AS proyecto_codigo,
  p.nombre_proyecto AS proyecto_nombre, e.codigo_expediente,
  (SELECT COUNT(*) FROM reportes_servicio_tecnico r
    WHERE r.equipo_numero_serie = q.numero_serie AND r.deleted_at IS NULL) AS reportes,
  (SELECT DATE_FORMAT(MAX(COALESCE(r.fecha_servicio, DATE(r.created_at))), '%Y-%m-%d')
    FROM reportes_servicio_tecnico r
    WHERE r.equipo_numero_serie = q.numero_serie AND r.deleted_at IS NULL) AS ultimo_servicio`;

const DESDE_LISTADO = `
  FROM equipos q
  JOIN clientes c ON c.id = q.cliente_id
  JOIN proyectos p ON p.id = q.proyecto_id
  LEFT JOIN expedientes_diseno e ON e.id = q.expediente_id`;

const normalizar = (fila) => (fila ? { ...fila, reportes: Number(fila.reportes) } : null);

// incluirEliminados: el número de serie es único aunque el equipo esté eliminado.
async function buscarPorNumeroSerie(pool, numeroSerie, { incluirEliminados = false } = {}) {
  const [filas] = await pool.query(
    `SELECT * FROM equipos WHERE numero_serie = ?${incluirEliminados ? "" : " AND deleted_at IS NULL"}`,
    [numeroSerie]
  );
  return filas[0] || null;
}

async function buscarPorExpediente(pool, expedienteId) {
  const [filas] = await pool.query("SELECT * FROM equipos WHERE expediente_id = ?", [expedienteId]);
  return filas[0] || null;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS_LISTADO} ${DESDE_LISTADO} WHERE q.id = ? AND q.deleted_at IS NULL`,
    [id]
  );
  return normalizar(filas[0]);
}

// Página del registro de equipos (por cliente y serial), con búsqueda por
// texto y filtros exactos. Devuelve { filas, total }.
async function listar(pool, { clienteId, proyectoId, numeroSerie, q, limite, offset }) {
  const { filas, total } = await listarPaginado(pool, {
    columnas: COLUMNAS_LISTADO,
    desde: DESDE_LISTADO,
    condiciones: ["q.deleted_at IS NULL"],
    filtros: {
      "q.cliente_id": clienteId,
      "q.proyecto_id": proyectoId,
      "q.numero_serie": numeroSerie,
    },
    q,
    buscarEn: [
      "q.numero_serie",
      "q.descripcion",
      "q.marca",
      "q.modelo",
      "c.nombre_razon_social",
      "p.codigo_pry",
    ],
    orden: "c.nombre_razon_social, q.numero_serie",
    limite,
    offset,
  });
  return { filas: filas.map(normalizar), total };
}

async function listarReportes(pool, numeroSerie) {
  const [filas] = await pool.query(
    `SELECT r.id, r.numero_reporte, r.tipo_servicio, r.en_garantia, r.proyecto_id,
            p.codigo_pry AS proyecto_codigo, u.nombre AS tecnico,
            DATE_FORMAT(r.fecha_servicio, '%Y-%m-%d') AS fecha_servicio,
            DATE_FORMAT(r.created_at, '%Y-%m-%d') AS creado
     FROM reportes_servicio_tecnico r
     JOIN proyectos p ON p.id = r.proyecto_id
     LEFT JOIN usuarios u ON u.id = r.tecnico_responsable_id
     WHERE r.equipo_numero_serie = ? AND r.deleted_at IS NULL
     ORDER BY COALESCE(r.fecha_servicio, DATE(r.created_at)) DESC, r.id DESC`,
    [numeroSerie]
  );
  return filas.map((f) => ({ ...f, en_garantia: Boolean(f.en_garantia) }));
}

async function contarReportes(pool, numeroSerie) {
  const [filas] = await pool.query(
    `SELECT COUNT(*) AS total FROM reportes_servicio_tecnico
     WHERE equipo_numero_serie = ?`,
    [numeroSerie]
  );
  return Number(filas[0].total);
}

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO equipos
      (numero_serie, cliente_id, proyecto_id, expediente_id, descripcion, marca, modelo,
       fecha_instalacion, origen, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.numero_serie,
      datos.cliente_id,
      datos.proyecto_id,
      datos.expediente_id || null,
      datos.descripcion,
      datos.marca || null,
      datos.modelo || null,
      datos.fecha_instalacion || null,
      datos.origen,
      datos.created_by || null,
    ]
  );
  return resultado.insertId;
}

const CAMPOS_ACTUALIZABLES = [
  "numero_serie",
  "cliente_id",
  "proyecto_id",
  "descripcion",
  "marca",
  "modelo",
  "fecha_instalacion",
  "deleted_at",
];

async function actualizar(pool, id, datos) {
  const campos = Object.keys(datos).filter((c) => CAMPOS_ACTUALIZABLES.includes(c));
  if (campos.length === 0) return;
  const asignaciones = campos.map((campo) => `${campo} = ?`).join(", ");
  await pool.query(`UPDATE equipos SET ${asignaciones} WHERE id = ?`, [
    ...campos.map((c) => datos[c]),
    id,
  ]);
}

module.exports = {
  buscarPorNumeroSerie,
  buscarPorExpediente,
  obtenerPorId,
  listar,
  listarReportes,
  contarReportes,
  crear,
  actualizar,
};
