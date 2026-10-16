const express = require("express");
const { crearUsuariosControlador } = require("../controladores/usuariosControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearUsuariosRutas(pool) {
  const router = express.Router();
  const controlador = crearUsuariosControlador(pool);

  router.get("/", envolverAsync(controlador.listar));

  return router;
}

module.exports = { crearUsuariosRutas };
