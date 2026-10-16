const usuariosRepositorio = require("../repositorios/usuariosRepositorio");

function crearUsuariosControlador(pool) {
  async function listar(req, res) {
    const usuarios = await usuariosRepositorio.listarActivos(pool);
    res.status(200).json({ usuarios });
  }

  return { listar };
}

module.exports = { crearUsuariosControlador };
