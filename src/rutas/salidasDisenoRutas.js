const express = require("express");
const { crearSalidasDisenoControlador } = require("../controladores/salidasDisenoControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearSalidasDisenoRutas(pool) {
  const router = express.Router({ mergeParams: true });
  const controlador = crearSalidasDisenoControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearSalidasDisenoRutas };
