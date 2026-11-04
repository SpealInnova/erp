const usuariosServicio = require("../servicios/usuarios");
const { crearUsuarioSchema } = require("../validaciones/usuariosSchemas");

function crearUsuariosControlador(pool) {
  async function listar(req, res) {
    const usuarios = await usuariosServicio.listarUsuarios(pool);
    res.status(200).json({ usuarios });
  }

  async function crear(req, res) {
    const datos = crearUsuarioSchema.parse(req.body);
    const usuario = await usuariosServicio.crearUsuario(pool, datos, req.usuario.id);
    res.status(201).json({ usuario });
  }

  return { listar, crear };
}

module.exports = { crearUsuariosControlador };
