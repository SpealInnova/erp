const { listarPaginado } = require("./consultaListado");

async function contarPorAnio(pool, anio) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM proyectos WHERE codigo_pry LIKE ?",
    [`PRY-${anio}-%`]
  );
  return filas[0].total;
}

async function buscarPorCodigoPry(pool, codigoPry) {
  const [filas] = await pool.query("SELECT id FROM proyectos WHERE codigo_pry = ?", [codigoPry]);
  return filas[0] || null;
}

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO proyectos
      (codigo_pry, cliente_id, cotizacion_id, linea_negocio, presupuesto_estimado, nombre_proyecto, estado, responsable_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.codigo_pry,
      datos.cliente_id,
      datos.cotizacion_id || null,
      datos.linea_negocio || null,
      datos.presupuesto_estimado ?? null,
      datos.nombre_proyecto,
      datos.estado,
      datos.responsable_id,
    ]
  );
  return resultado.insertId;
}

async function obtenerGastoReal(pool, proyectoId) {
  const [filas] = await pool.query(
    `SELECT COALESCE(SUM(oci.cantidad * oci.precio_unitario), 0) AS total
     FROM orden_compra_items oci
     JOIN ordenes_compra oc ON oc.id = oci.orden_compra_id
     JOIN requisiciones r ON r.id = oc.requisicion_id
     WHERE r.proyecto_id = ? AND oc.deleted_at IS NULL AND r.deleted_at IS NULL`,
    [proyectoId]
  );
  return Number(filas[0].total);
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM proyectos WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

// Página de la lista (más recientes primero) con búsqueda por texto y estado;
// trae resueltos los nombres que la tabla muestra. Devuelve { filas, total }.
async function listar(pool, { limite, offset, q, estado }) {
  return listarPaginado(pool, {
    columnas: "p.*, c.nombre_razon_social AS cliente_nombre, u.nombre AS responsable_nombre",
    desde: `FROM proyectos p
       LEFT JOIN clientes c ON c.id = p.cliente_id
       LEFT JOIN usuarios u ON u.id = p.responsable_id`,
    condiciones: ["p.deleted_at IS NULL"],
    q,
    buscarEn: ["p.codigo_pry", "p.nombre_proyecto", "c.nombre_razon_social"],
    filtros: { "p.estado": estado },
    orden: "p.id DESC",
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
  await pool.query(`UPDATE proyectos SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function actualizarEstado(pool, id, estado) {
  await pool.query("UPDATE proyectos SET estado = ? WHERE id = ?", [estado, id]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE proyectos SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  contarPorAnio,
  buscarPorCodigoPry,
  crear,
  obtenerPorId,
  obtenerGastoReal,
  listar,
  actualizar,
  actualizarEstado,
  softDelete,
};
