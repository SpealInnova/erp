const actasCierreServicio = require("../servicios/actasCierre");
const {
  crearActaSchema,
  actualizarActaSchema,
  listarActasQuerySchema,
} = require("../validaciones/actasCierreSchemas");
const { conMotivo } = require("../validaciones/versionesSchemas");

function crearActasCierreControlador(pool) {
  async function crear(req, res) {
    const datos = crearActaSchema.parse(req.body);
    const acta = await actasCierreServicio.crearActa(pool, datos, req.usuario.id);
    res.status(201).json({ acta });
  }

  async function listar(req, res) {
    const query = listarActasQuerySchema.parse(req.query);
    const { filas, total } = await actasCierreServicio.listarActas(pool, query);
    res.status(200).json({
      actas: filas,
      total,
      pagina: query.pagina,
      tamanoPagina: query.tamanoPagina,
    });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const acta = await actasCierreServicio.obtenerConItems(pool, id);
    res.status(200).json({ acta });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarActaSchema.parse(req.body);
    const acta = await actasCierreServicio.actualizarActa(pool, id, datos, req.usuario.id);
    res.status(200).json({ acta });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await actasCierreServicio.eliminarActa(pool, id, req.usuario.id);
    res.status(204).send();
  }

  async function crearVersion(req, res) {
    const id = Number(req.params.id);
    const datos = conMotivo(actualizarActaSchema).parse(req.body);
    const acta = await actasCierreServicio.crearVersionActa(pool, id, datos, req.usuario.id);
    res.status(200).json({ acta });
  }

  return { crear, listar, obtener, actualizar, eliminar, crearVersion };
}

module.exports = { crearActasCierreControlador };
