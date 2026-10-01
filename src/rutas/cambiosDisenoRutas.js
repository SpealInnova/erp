const express = require("express");
const { crearCambiosDisenoControlador } = require("../controladores/cambiosDisenoControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearCambiosDisenoRutas(pool) {
  const router = express.Router({ mergeParams: true });
  const controlador = crearCambiosDisenoControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearCambiosDisenoRutas };
