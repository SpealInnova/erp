const { listarPaginado } = require("./consultaListado");

async function contarPorAnio(pool, anio) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM actas_entrega_equipos WHERE numero_acta LIKE ?",
    [`AEE-${anio}-%`]
  );
  return filas[0].total;
}

async function buscarPorNumero(pool, numero) {
  const [filas] = await pool.query(
    "SELECT id FROM actas_entrega_equipos WHERE numero_acta = ?",
    [numero]
  );
  return filas[0] || null;
}

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO actas_entrega_equipos
      (numero_acta, proyecto_id, cliente_id, numero_contrato_oc, objeto, lugar_entrega,
       entregante_id, receptor_nombre, receptor_identificacion, receptor_cargo,
       observaciones, fecha_elaboracion, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.numero_acta,
      datos.proyecto_id,
      datos.cliente_id,
      datos.numero_contrato_oc || null,
      datos.objeto,
      datos.lugar_entrega || null,
      datos.entregante_id,
      datos.receptor_nombre,
      datos.receptor_identificacion || null,
      datos.receptor_cargo || null,
      datos.observaciones || null,
      datos.fecha_elaboracion,
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM actas_entrega_equipos WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

// Página de la lista (más recientes primero) con búsqueda por texto;
// trae resueltos los nombres que la tabla muestra. Devuelve { filas, total }.
async function listar(pool, { limite, offset, q }) {
  return listarPaginado(pool, {
    columnas: "a.*, p.codigo_pry AS proyecto_codigo, c.nombre_razon_social AS cliente_nombre",
    desde: `FROM actas_entrega_equipos a
       LEFT JOIN proyectos p ON p.id = a.proyecto_id
       LEFT JOIN clientes c ON c.id = a.cliente_id`,
    condiciones: ["a.deleted_at IS NULL"],
    q,
    buscarEn: ["a.numero_acta", "p.codigo_pry", "c.nombre_razon_social"],
    orden: "a.id DESC",
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
  await pool.query(`UPDATE actas_entrega_equipos SET ${asignaciones} WHERE id = ?`, [
    ...valores,
    id,
  ]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE actas_entrega_equipos SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  contarPorAnio,
  buscarPorNumero,
  crear,
  obtenerPorId,
  listar,
  actualizar,
  softDelete,
};
