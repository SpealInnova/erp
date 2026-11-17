const express = require("express");
const { crearUsuariosControlador } = require("../controladores/usuariosControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");
const { requireRol } = require("../middlewares/requireRol");

function crearUsuariosRutas(pool) {
  const router = express.Router();
  const controlador = crearUsuariosControlador(pool);

  router.get("/", envolverAsync(controlador.listar));
  router.post("/", requireRol("admin"), envolverAsync(controlador.crear));
  router.put("/:id", requireRol("admin"), envolverAsync(controlador.actualizar));

  return router;
}

module.exports = { crearUsuariosRutas };
