const avisosActividades = require("../servicios/avisosActividades");

function crearMisActividadesControlador(pool) {
  async function pendientes(req, res) {
    const resultado = await avisosActividades.listarMisActividades(pool, req.usuario.id);
    res.status(200).json(resultado);
  }

  return { pendientes };
}

module.exports = { crearMisActividadesControlador };
