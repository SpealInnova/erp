const express = require("express");
const { crearMisActividadesControlador } = require("../controladores/misActividadesControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

// Actividades del usuario con sesión, de todos sus proyectos.
function crearMisActividadesRutas(pool) {
  const router = express.Router();
  const controlador = crearMisActividadesControlador(pool);

  router.get("/pendientes", envolverAsync(controlador.pendientes));

  return router;
}

module.exports = { crearMisActividadesRutas };
