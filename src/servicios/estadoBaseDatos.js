async function verificarConexion(pool) {
  const conexion = await pool.getConnection();
  try {
    await conexion.query("SELECT 1");
    return true;
  } finally {
    conexion.release();
  }
}

module.exports = { verificarConexion };
