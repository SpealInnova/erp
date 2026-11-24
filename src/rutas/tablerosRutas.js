const express = require("express");
const { crearTablerosControlador } = require("../controladores/tablerosControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

// Tableros de solo lectura: agregan datos de varios módulos en una sola
// respuesta para no obligar al navegador a hacer decenas de peticiones.
function crearTablerosRutas(pool) {
  const router = express.Router();
  const controlador = crearTablerosControlador(pool);

  router.get("/general", envolverAsync(controlador.general));
  router.get("/gerencial", envolverAsync(controlador.gerencial));
  router.get("/tiempos", envolverAsync(controlador.tiempos));
  router.get("/comercial", envolverAsync(controlador.comercial));
  router.get("/compras", envolverAsync(controlador.compras));

  return router;
}

module.exports = { crearTablerosRutas };
