const tablerosServicio = require("../servicios/tableros");

function crearTablerosControlador(pool) {
  async function gerencial(req, res) {
    const tablero = await tablerosServicio.obtenerTableroGerencial(pool);
    res.status(200).json({ tablero });
  }

  async function comercial(req, res) {
    const tablero = await tablerosServicio.obtenerTableroComercial(pool);
    res.status(200).json({ tablero });
  }

  async function compras(req, res) {
    const tablero = await tablerosServicio.obtenerTableroCompras(pool);
    res.status(200).json({ tablero });
  }

  return { gerencial, comercial, compras };
}

module.exports = { crearTablerosControlador };
