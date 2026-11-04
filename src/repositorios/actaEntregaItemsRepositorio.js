async function insertarMuchos(pool, actaId, items) {
  if (items.length === 0) {
    return;
  }
  const valores = items.map((item) => [
    actaId,
    item.descripcion_equipo,
    item.cantidad,
    item.marca || null,
    item.modelo || null,
    item.numero_serie || null,
    item.expediente_id || null,
    item.cumple,
  ]);
  await pool.query(
    `INSERT INTO acta_entrega_items
      (acta_id, descripcion_equipo, cantidad, marca, modelo, numero_serie, expediente_id, cumple)
     VALUES ?`,
    [valores]
  );
}

async function listarPorActa(pool, actaId) {
  const [filas] = await pool.query(
    "SELECT * FROM acta_entrega_items WHERE acta_id = ? ORDER BY id",
    [actaId]
  );
  return filas;
}

async function eliminarPorActa(pool, actaId) {
  await pool.query("DELETE FROM acta_entrega_items WHERE acta_id = ?", [actaId]);
}

module.exports = { insertarMuchos, listarPorActa, eliminarPorActa };
