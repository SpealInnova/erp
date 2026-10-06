const express = require("express");
const {
  crearParametrosMedidosControlador,
} = require("../controladores/parametrosMedidosControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearParametrosMedidosRutas(pool) {
  const router = express.Router({ mergeParams: true });
  const controlador = crearParametrosMedidosControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearParametrosMedidosRutas };
