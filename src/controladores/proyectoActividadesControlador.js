const proyectoActividadesServicio = require("../servicios/proyectoActividades");
const {
  crearActividadSchema,
  actualizarActividadSchema,
} = require("../validaciones/proyectoActividadesSchemas");

function crearProyectoActividadesControlador(pool) {
  async function crear(req, res) {
    const proyectoId = Number(req.params.proyectoId);
    const datos = crearActividadSchema.parse(req.body);
    const actividad = await proyectoActividadesServicio.agregarActividad(
      pool,
      proyectoId,
      datos,
      req.usuario.id
    );
    res.status(201).json({ actividad });
  }

  async function listar(req, res) {
    const proyectoId = Number(req.params.proyectoId);
    const actividades = await proyectoActividadesServicio.listarActividades(pool, proyectoId);
    res.status(200).json({ actividades });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarActividadSchema.parse(req.body);
    const actividad = await proyectoActividadesServicio.actualizarActividad(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ actividad });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await proyectoActividadesServicio.eliminarActividad(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, actualizar, eliminar };
}

module.exports = { crearProyectoActividadesControlador };
