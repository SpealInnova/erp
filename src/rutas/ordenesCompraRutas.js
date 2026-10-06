const express = require("express");
const { crearOrdenesCompraControlador } = require("../controladores/ordenesCompraControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearOrdenesCompraRutas(pool) {
  const router = express.Router();
  const controlador = crearOrdenesCompraControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.patch("/:id/estado", envolverAsync(controlador.cambiarEstado));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearOrdenesCompraRutas };
