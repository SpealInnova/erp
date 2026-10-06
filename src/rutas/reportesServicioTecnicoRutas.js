const express = require("express");
const {
  crearReportesServicioTecnicoControlador,
} = require("../controladores/reportesServicioTecnicoControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearReportesServicioTecnicoRutas(pool) {
  const router = express.Router();
  const controlador = crearReportesServicioTecnicoControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearReportesServicioTecnicoRutas };
