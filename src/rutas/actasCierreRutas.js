const express = require("express");
const { crearActasCierreControlador } = require("../controladores/actasCierreControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearActasCierreRutas(pool) {
  const router = express.Router();
  const controlador = crearActasCierreControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearActasCierreRutas };
