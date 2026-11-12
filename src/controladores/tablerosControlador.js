const tablerosServicio = require("../servicios/tableros");

function crearTablerosControlador(pool) {
  async function gerencial(req, res) {
    const tablero = await tablerosServicio.obtenerTableroGerencial(pool);
    res.status(200).json({ tablero });
  }

  return { gerencial };
}

module.exports = { crearTablerosControlador };
