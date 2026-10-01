const express = require("express");
const {
  crearRequisitosEntradaControlador,
} = require("../controladores/requisitosEntradaControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearRequisitosEntradaRutas(pool) {
  const router = express.Router({ mergeParams: true });
  const controlador = crearRequisitosEntradaControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearRequisitosEntradaRutas };
