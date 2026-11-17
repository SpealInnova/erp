const { listarPaginado } = require("./consultaListado");

async function contarPorAnio(pool, anio) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM ordenes_compra WHERE numero_oc LIKE ?",
    [`OC-${anio}-%`]
  );
  return filas[0].total;
}

async function buscarPorNumero(pool, numero) {
  const [filas] = await pool.query("SELECT id FROM ordenes_compra WHERE numero_oc = ?", [numero]);
  return filas[0] || null;
}

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO ordenes_compra (numero_oc, requisicion_id, proveedor_id, estado, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [datos.numero_oc, datos.requisicion_id, datos.proveedor_id, datos.estado, datos.created_by]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM ordenes_compra WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

// Página de la lista (más recientes primero) con búsqueda por texto y estado;
// trae resueltos los nombres que la tabla muestra. Devuelve { filas, total }.
async function listar(pool, { limite, offset, q, estado }) {
  return listarPaginado(pool, {
    columnas:
      "oc.*, pr.razon_social AS proveedor_nombre, r.numero_requisicion, p.codigo_pry AS proyecto_codigo",
    desde: `FROM ordenes_compra oc
       LEFT JOIN proveedores pr ON pr.id = oc.proveedor_id
       LEFT JOIN requisiciones r ON r.id = oc.requisicion_id
       LEFT JOIN proyectos p ON p.id = r.proyecto_id`,
    condiciones: ["oc.deleted_at IS NULL"],
    q,
    buscarEn: ["oc.numero_oc", "pr.razon_social", "r.numero_requisicion", "p.codigo_pry"],
    filtros: { "oc.estado": estado },
    orden: "oc.id DESC",
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
  await pool.query(`UPDATE ordenes_compra SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function actualizarEstado(pool, id, estado, { aprobadoPor, aprobadoEn } = {}) {
  if (aprobadoPor) {
    await pool.query(
      "UPDATE ordenes_compra SET estado = ?, aprobado_por = ?, aprobado_en = ? WHERE id = ?",
      [estado, aprobadoPor, aprobadoEn, id]
    );
    return;
  }
  await pool.query("UPDATE ordenes_compra SET estado = ? WHERE id = ?", [estado, id]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE ordenes_compra SET deleted_at = NOW() WHERE id = ?", [id]);
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
};
