const express = require("express");
const { crearProveedoresControlador } = require("../controladores/proveedoresControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearProveedoresRutas(pool) {
  const router = express.Router();
  const controlador = crearProveedoresControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearProveedoresRutas };
