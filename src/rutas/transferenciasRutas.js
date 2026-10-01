const express = require("express");
const { crearTransferenciasControlador } = require("../controladores/transferenciasControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearTransferenciasRutas(pool) {
  const router = express.Router({ mergeParams: true });
  const controlador = crearTransferenciasControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearTransferenciasRutas };
