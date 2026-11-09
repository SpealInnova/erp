const archivosAdjuntosServicio = require("../servicios/archivosAdjuntos");
const {
  subirArchivoSchema,
  listarArchivosQuerySchema,
} = require("../validaciones/archivosAdjuntosSchemas");
const { ErrorArchivoRequerido } = require("../dominio/erroresArchivosAdjuntos");

function crearArchivosAdjuntosControlador(pool) {
  async function subir(req, res) {
    const { tabla, registro_id: registroId } = subirArchivoSchema.parse(req.body);
    if (!req.file) {
      throw new ErrorArchivoRequerido();
    }
    const archivo = await archivosAdjuntosServicio.subirArchivo(
      pool,
      { tabla, registroId, archivo: req.file },
      req.usuario.id
    );
    res.status(201).json({ archivo });
  }

  async function listar(req, res) {
    const { tabla, registro_id: registroId } = listarArchivosQuerySchema.parse(req.query);
    const archivos = await archivosAdjuntosServicio.listarArchivos(pool, tabla, registroId);
    res.status(200).json({ archivos });
  }

  async function eliminar(req, res) {
    const id = Number(req.params.id);
    await archivosAdjuntosServicio.eliminarArchivo(pool, id, req.usuario.id);
    res.status(204).send();
  }

  return { subir, listar, eliminar };
}

module.exports = { crearArchivosAdjuntosControlador };
