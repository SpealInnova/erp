async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO proveedores
      (nit_cc, razon_social, tipo_persona, origen, clasificacion,
       contacto_comercial_nombre, contacto_comercial_telefono, contacto_comercial_email,
       contacto_pagos_nombre, contacto_pagos_telefono, contacto_pagos_email,
       contacto_tecnico_nombre, contacto_tecnico_telefono, contacto_tecnico_email,
       documentacion_estado, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.nit_cc,
      datos.razon_social,
      datos.tipo_persona,
      datos.origen,
      datos.clasificacion,
      datos.contacto_comercial_nombre || null,
      datos.contacto_comercial_telefono || null,
      datos.contacto_comercial_email || null,
      datos.contacto_pagos_nombre || null,
      datos.contacto_pagos_telefono || null,
      datos.contacto_pagos_email || null,
      datos.contacto_tecnico_nombre || null,
      datos.contacto_tecnico_telefono || null,
      datos.contacto_tecnico_email || null,
      datos.documentacion_estado ? JSON.stringify(datos.documentacion_estado) : null,
      datos.created_by,
    ]
  );
  return resultado.insertId;
}

async function buscarPorNitCc(pool, nitCc, excluirId = null) {
  const params = [nitCc];
  let sql = "SELECT id FROM proveedores WHERE nit_cc = ? AND deleted_at IS NULL";
  if (excluirId) {
    sql += " AND id != ?";
    params.push(excluirId);
  }
  const [filas] = await pool.query(sql, params);
  return filas[0] || null;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM proveedores WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return filas[0] || null;
}

async function listar(pool, { limite, offset }) {
  const [filas] = await pool.query(
    "SELECT * FROM proveedores WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ? OFFSET ?",
    [limite, offset]
  );
  return filas;
}

async function actualizar(pool, id, datos) {
  const campos = Object.keys(datos);
  if (campos.length === 0) {
    return;
  }
  const asignaciones = campos.map((campo) => `${campo} = ?`).join(", ");
  const valores = campos.map((campo) =>
    campo === "documentacion_estado" ? JSON.stringify(datos[campo]) : datos[campo]
  );
  await pool.query(`UPDATE proveedores SET ${asignaciones} WHERE id = ?`, [...valores, id]);
}

async function softDelete(pool, id) {
  await pool.query("UPDATE proveedores SET deleted_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  crear,
  buscarPorNitCc,
  obtenerPorId,
  listar,
  actualizar,
  softDelete,
};
