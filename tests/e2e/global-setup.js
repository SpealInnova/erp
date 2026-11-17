const bcrypt = require("bcryptjs");
const { crearPool } = require("../../src/config/db");
const { PASSWORD, USUARIO_PRINCIPAL, USUARIO_COLEGA } = require("./fixtures");

module.exports = async function globalSetup() {
  const pool = crearPool();
  try {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    for (const usuario of [USUARIO_PRINCIPAL, USUARIO_COLEGA]) {
      await pool.query(
        `INSERT INTO usuarios (nombre, correo, password_hash, rol, cargo, activo)
         VALUES (?, ?, ?, 'tester', ?, 1)
         ON DUPLICATE KEY UPDATE
           password_hash = VALUES(password_hash),
           cargo = VALUES(cargo),
           activo = 1,
           intentos_fallidos = 0,
           bloqueado_hasta = NULL,
           deleted_at = NULL`,
        [usuario.nombre, usuario.correo, passwordHash, usuario.cargo]
      );
    }
  } finally {
    await pool.end();
  }
};
