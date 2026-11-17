const proyectoDocumentosServicio = require("../servicios/proyectoDocumentos");

function crearProyectoDocumentosControlador(pool) {
  async function listar(req, res) {
    const proyectoId = Number(req.params.proyectoId);
    const documentos = await proyectoDocumentosServicio.obtenerDocumentosProyecto(pool, proyectoId);
    res.status(200).json({ documentos });
  }

  return { listar };
}

module.exports = { crearProyectoDocumentosControlador };
