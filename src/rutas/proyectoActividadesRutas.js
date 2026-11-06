const express = require("express");
const {
  crearProyectoActividadesControlador,
} = require("../controladores/proyectoActividadesControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearProyectoActividadesRutas(pool) {
  const router = express.Router({ mergeParams: true });
  const controlador = crearProyectoActividadesControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearProyectoActividadesRutas };
