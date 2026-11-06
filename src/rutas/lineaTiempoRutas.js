const express = require("express");
const { crearLineaTiempoControlador } = require("../controladores/lineaTiempoControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearLineaTiempoRutas(pool) {
  const router = express.Router({ mergeParams: true });
  const controlador = crearLineaTiempoControlador(pool);

  router.get("/", envolverAsync(controlador.listar));

  return router;
}

module.exports = { crearLineaTiempoRutas };
