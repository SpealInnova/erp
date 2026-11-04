const express = require("express");
const { crearUsuariosControlador } = require("../controladores/usuariosControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");
const { requireRol } = require("../middlewares/requireRol");

function crearUsuariosRutas(pool) {
  const router = express.Router();
  const controlador = crearUsuariosControlador(pool);

  router.get("/", envolverAsync(controlador.listar));
  router.post("/", requireRol("admin"), envolverAsync(controlador.crear));

  return router;
}

module.exports = { crearUsuariosRutas };
