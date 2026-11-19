const tablerosServicio = require("../servicios/tableros");
const { obtenerTableroGeneral } = require("../servicios/tableroGeneral");
const { exigirPermiso } = require("../servicios/autorizacion");

function crearTablerosControlador(pool) {
  async function gerencial(req, res) {
    await exigirPermiso(pool, req.usuario.id, "ver_tablero_gerencial");
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

  // Para todos los perfiles: lo que le toca a quien consulta.
  async function general(req, res) {
    const tablero = await obtenerTableroGeneral(pool, req.usuario.id);
    res.status(200).json({ tablero });
  }

  return { gerencial, comercial, compras, general };
}

module.exports = { crearTablerosControlador };
