async function insertarMuchos(pool, requisicionId, items) {
  if (items.length === 0) {
    return;
  }
  const valores = items.map((item) => [requisicionId, item.descripcion, item.cantidad, item.unidad]);
  await pool.query(
    "INSERT INTO requisicion_items (requisicion_id, descripcion, cantidad, unidad) VALUES ?",
    [valores]
  );
}

async function listarPorRequisicion(pool, requisicionId) {
  const [filas] = await pool.query(
    "SELECT * FROM requisicion_items WHERE requisicion_id = ? ORDER BY id",
    [requisicionId]
  );
  return filas;
}

async function eliminarPorRequisicion(pool, requisicionId) {
  await pool.query("DELETE FROM requisicion_items WHERE requisicion_id = ?", [requisicionId]);
}

module.exports = { insertarMuchos, listarPorRequisicion, eliminarPorRequisicion };
