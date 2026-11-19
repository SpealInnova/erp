const express = require("express");
const { envolverAsync } = require("../middlewares/envolverAsync");
const tareas = require("../servicios/tareas");
const {
  crearTareaSchema,
  actualizarTareaSchema,
  listarTareasSchema,
} = require("../validaciones/tareasSchemas");

// Gestor de tareas: actividades fuera de los proyectos. Cada usuario ve las
// suyas y las que creó para otras personas.
function crearTareasRutas(pool) {
  const router = express.Router();

  router.get(
    "/",
    envolverAsync(async (req, res) => {
      const filtros = listarTareasSchema.parse(req.query);
      res.status(200).json({ tareas: await tareas.listarTareas(pool, req.usuario.id, filtros) });
    })
  );
  router.post(
    "/",
    envolverAsync(async (req, res) => {
      const datos = crearTareaSchema.parse(req.body);
      res.status(201).json({ tarea: await tareas.crearTarea(pool, datos, req.usuario.id) });
    })
  );
  router.put(
    "/:id",
    envolverAsync(async (req, res) => {
      const datos = actualizarTareaSchema.parse(req.body);
      const tarea = await tareas.actualizarTarea(
        pool,
        Number(req.params.id),
        datos,
        req.usuario.id
      );
      res.status(200).json({ tarea });
    })
  );
  router.delete(
    "/:id",
    envolverAsync(async (req, res) => {
      await tareas.eliminarTarea(pool, Number(req.params.id), req.usuario.id);
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { crearTareasRutas };
