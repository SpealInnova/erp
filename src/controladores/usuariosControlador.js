const usuariosServicio = require("../servicios/usuarios");
const { crearUsuarioSchema, actualizarUsuarioSchema } = require("../validaciones/usuariosSchemas");

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

  async function actualizar(req, res) {
    const id = Number(req.params.id);
    const datos = actualizarUsuarioSchema.parse(req.body);
    const usuario = await usuariosServicio.actualizarUsuario(pool, id, datos, req.usuario.id);
    res.status(200).json({ usuario });
  }

  return { listar, crear, actualizar };
}

module.exports = { crearUsuariosControlador };
