const faseResponsables = require("../servicios/proyectoFaseResponsables");
const { asignarResponsableSchema } = require("../validaciones/proyectoFaseResponsablesSchemas");

function crearProyectoFaseResponsablesControlador(pool) {
  async function crear(req, res) {
    const proyectoId = Number(req.params.proyectoId);
    const datos = asignarResponsableSchema.parse(req.body);
    const responsable = await faseResponsables.asignarResponsable(
      pool,
      proyectoId,
      datos,
      req.usuario.id
    );
    res.status(201).json({ responsable });
  }

  async function listar(req, res) {
    const proyectoId = Number(req.params.proyectoId);
    const responsables = await faseResponsables.listarResponsables(pool, proyectoId);
    res.status(200).json({ responsables });
  }

  async function eliminar(req, res) {
    const proyectoId = Number(req.params.proyectoId);
    const id = Number(req.params.id);
    await faseResponsables.quitarResponsable(pool, proyectoId, id, req.usuario.id);
    res.status(204).send();
  }

  return { crear, listar, eliminar };
}

module.exports = { crearProyectoFaseResponsablesControlador };
