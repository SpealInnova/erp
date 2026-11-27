const express = require("express");
const {
  crearListadoMaestroServiciosControlador,
} = require("../controladores/listadoMaestroServiciosControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

// Listado Maestro de Servicios (FO-ST-006): solo lectura, cualquier usuario con
// sesión (igual que la lista de reportes de servicio).
function crearListadoMaestroServiciosRutas(pool) {
  const router = express.Router();
  const controlador = crearListadoMaestroServiciosControlador(pool);

  router.get("/", envolverAsync(controlador.listar));
  router.get("/csv", envolverAsync(controlador.descargarCsv));

  return router;
}

module.exports = { crearListadoMaestroServiciosRutas };
