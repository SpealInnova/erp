async function insertarMuchos(pool, actaId, items) {
  if (items.length === 0) {
    return;
  }
  const valores = items.map((item) => [actaId, item.elemento, item.cantidad, item.cumple]);
  await pool.query(
    "INSERT INTO acta_items_verificados (acta_id, elemento, cantidad, cumple) VALUES ?",
    [valores]
  );
}

async function listarPorActa(pool, actaId) {
  const [filas] = await pool.query(
    "SELECT * FROM acta_items_verificados WHERE acta_id = ? ORDER BY id",
    [actaId]
  );
  return filas;
}

async function eliminarPorActa(pool, actaId) {
  await pool.query("DELETE FROM acta_items_verificados WHERE acta_id = ?", [actaId]);
}

module.exports = { insertarMuchos, listarPorActa, eliminarPorActa };
