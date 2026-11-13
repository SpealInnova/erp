const express = require("express");
const { crearEquiposControlador } = require("../controladores/equiposControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

// Registro de equipos instalados. Los que salen de un expediente se mantienen
// solos; aquí se registran y corrigen los equipos históricos (sin expediente).
function crearEquiposRutas(pool) {
  const router = express.Router();
  const controlador = crearEquiposControlador(pool);

  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.post("/", envolverAsync(controlador.crear));
  router.put("/:id", envolverAsync(controlador.actualizar));

  return router;
}

module.exports = { crearEquiposRutas };
