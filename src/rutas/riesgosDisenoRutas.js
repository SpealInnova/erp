const express = require("express");
const { crearRiesgosDisenoControlador } = require("../controladores/riesgosDisenoControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearRiesgosDisenoRutas(pool) {
  const router = express.Router({ mergeParams: true });
  const controlador = crearRiesgosDisenoControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearRiesgosDisenoRutas };
