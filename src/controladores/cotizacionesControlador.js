const cotizacionesServicio = require("../servicios/cotizaciones");
const {
  crearCotizacionSchema,
  actualizarCotizacionSchema,
  cambiarEstadoSchema,
  listarCotizacionesQuerySchema,
} = require("../validaciones/cotizacionesSchemas");
const { conMotivo } = require("../validaciones/versionesSchemas");

function crearCotizacionesControlador(pool) {
  async function crear(req, res) {
    const datos = crearCotizacionSchema.parse(req.body);
    const cotizacion = await cotizacionesServicio.crearCotizacion(pool, datos, req.usuario.id);
    res.status(201).json({ cotizacion });
  }

  async function listar(req, res) {
    const query = listarCotizacionesQuerySchema.parse(req.query);
    const { filas, total } = await cotizacionesServicio.listarCotizaciones(pool, query);
    res.status(200).json({
      cotizaciones: filas,
      total,
      pagina: query.pagina,
      tamanoPagina: query.tamanoPagina,
    });
  }

  async function obtener(req, res) {
    const id = Number(req.params.id);
    const cotizacion = await cotizacionesServicio.obtenerConItems(pool, id);
    res.status(200).json({ cotizacion });
  }

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarCotizacionSchema.parse(req.body);
    const cotizacion = await cotizacionesServicio.actualizarCotizacion(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ cotizacion });
  }

  async function cambiarEstado(req, res) {
    const id = Number(req.params.id);
    const { estado } = cambiarEstadoSchema.parse(req.body);
    const cotizacion = await cotizacionesServicio.cambiarEstadoCotizacion(
      pool,
      id,
      estado,
      req.usuario.id
    );
    res.status(200).json({ cotizacion });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await cotizacionesServicio.eliminarCotizacion(pool, id, req.usuario.id);
    res.status(204).send();
  }

  async function crearVersion(req, res) {
    const id = Number(req.params.id);
    const datos = conMotivo(actualizarCotizacionSchema).parse(req.body);
    const cotizacion = await cotizacionesServicio.crearVersionCotizacion(
      pool,
      id,
      datos,
      req.usuario.id
    );
    res.status(200).json({ cotizacion });
  }

  return { crear, listar, obtener, actualizar, cambiarEstado, eliminar, crearVersion };
}

module.exports = { crearCotizacionesControlador };
