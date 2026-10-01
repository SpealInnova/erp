const express = require("express");
const {
  crearRevisionesDisenoControlador,
} = require("../controladores/revisionesDisenoControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearRevisionesDisenoRutas(pool) {
  const router = express.Router({ mergeParams: true });
  const controlador = crearRevisionesDisenoControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearRevisionesDisenoRutas };
