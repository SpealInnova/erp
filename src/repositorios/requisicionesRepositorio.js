const { listarPaginado } = require("./consultaListado");

async function buscarPorNumero(pool, numero) {
  const [filas] = await pool.query("SELECT id FROM requisiciones WHERE numero_requisicion = ?", [
    numero,
  ]);
  return filas[0] || null;
}

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO requisiciones (numero_requisicion, proyecto_id, solicitante_id, procedencia, estado)
     VALUES (?, ?, ?, ?, ?)`,
    [datos.numero_requisicion, datos.proyecto_id, datos.solicitante_id, datos.procedencia, datos.estado]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM requisiciones WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

// Página de la lista (más recientes primero) con búsqueda por texto y estado;
// trae resueltos los nombres que la tabla muestra. Devuelve { filas, total }.
async function listar(pool, { limite, offset, q, estado }) {
  return listarPaginado(pool, {
    columnas: "r.*, p.codigo_pry AS proyecto_codigo, p.nombre_proyecto AS proyecto_nombre, u.nombre AS solicitante_nombre",
    desde: `FROM requisiciones r
       LEFT JOIN proyectos p ON p.id = r.proyecto_id
       LEFT JOIN usuarios u ON u.id = r.solicitante_id`,
    condiciones: ["r.deleted_at IS NULL"],
    q,
    buscarEn: ["r.numero_requisicion", "p.codigo_pry", "p.nombre_proyecto"],
    filtros: { "r.estado": estado },
    orden: "r.id DESC",
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
  await pool.query(`UPDATE requisiciones SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function actualizarEstado(pool, id, estado) {
  await pool.query("UPDATE requisiciones SET estado = ? WHERE id = ?", [estado, id]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE requisiciones SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  buscarPorNumero,
  crear,
  obtenerPorId,
  listar,
  actualizar,
  actualizarEstado,
  softDelete,
};
