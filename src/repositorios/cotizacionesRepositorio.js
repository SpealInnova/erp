const { listarPaginado } = require("./consultaListado");

async function contarPorAnio(pool, anio) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM cotizaciones WHERE numero_cotizacion LIKE ?",
    [`COT-${anio}-%`]
  );
  return filas[0].total;
}

async function buscarPorNumero(pool, numero) {
  const [filas] = await pool.query("SELECT id FROM cotizaciones WHERE numero_cotizacion = ?", [
    numero,
  ]);
  return filas[0] || null;
}

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO cotizaciones
      (numero_cotizacion, cliente_id, asesor_comercial_id, estado, fecha_validez, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      datos.numero_cotizacion,
      datos.cliente_id,
      datos.asesor_comercial_id,
      datos.estado,
      datos.fecha_validez || null,
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM cotizaciones WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

// Página de la lista (más recientes primero) con búsqueda por texto y estado;
// trae resueltos los nombres que la tabla muestra. Devuelve { filas, total }.
async function listar(pool, { limite, offset, q, estado }) {
  return listarPaginado(pool, {
    columnas: "q.*, c.nombre_razon_social AS cliente_nombre, u.nombre AS asesor_nombre",
    desde: `FROM cotizaciones q
       LEFT JOIN clientes c ON c.id = q.cliente_id
       LEFT JOIN usuarios u ON u.id = q.asesor_comercial_id`,
    condiciones: ["q.deleted_at IS NULL"],
    q,
    buscarEn: ["q.numero_cotizacion", "c.nombre_razon_social"],
    filtros: { "q.estado": estado },
    orden: "q.id DESC",
    limite,
    offset,
  });
}

async function actualizar(pool, id, datos) {
  const campos = Object.keys(datos);
  if (campos.length === 0) {
    return;
  }
  const asignaciones = campos.map((campo) => `${campo} = ?`).join(", ");
  const valores = campos.map((campo) => datos[campo]);
  await pool.query(`UPDATE cotizaciones SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function actualizarEstado(pool, id, estado) {
  await pool.query("UPDATE cotizaciones SET estado = ? WHERE id = ?", [estado, id]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE cotizaciones SET deleted_at = NOW() WHERE id = ?", [id]);
}

// Proyectos vigentes que tienen esta cotización como origen.
async function listarProyectosQueLaUsan(pool, cotizacionId) {
  const [filas] = await pool.query(
    "SELECT id, codigo_pry FROM proyectos WHERE cotizacion_id = ? AND deleted_at IS NULL",
    [cotizacionId]
  );
  return filas;
}

module.exports = {
  contarPorAnio,
  buscarPorNumero,
  crear,
  obtenerPorId,
  listar,
  actualizar,
  actualizarEstado,
  softDelete,
  listarProyectosQueLaUsan,
};
