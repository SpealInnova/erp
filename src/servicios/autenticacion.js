const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const { estaBloqueado, calcularTrasIntentoFallido } = require("../dominio/politicaBloqueo");
const {
  ErrorCredencialesInvalidas,
  ErrorUsuarioInactivo,
  ErrorUsuarioBloqueado,
} = require("../dominio/erroresAuth");

const JWT_EXPIRA_EN = "8h";

async function iniciarSesion(pool, { correo, password }) {
  const usuario = await usuariosRepositorio.buscarPorCorreo(pool, correo);
  if (!usuario) {
    throw new ErrorCredencialesInvalidas();
  }
  if (!usuario.activo) {
    throw new ErrorUsuarioInactivo();
  }
  if (estaBloqueado(usuario)) {
    throw new ErrorUsuarioBloqueado(usuario.bloqueado_hasta);
  }

  const passwordValido = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValido) {
    const { intentos, bloqueadoHasta } = calcularTrasIntentoFallido(usuario.intentos_fallidos);
    await usuariosRepositorio.registrarIntentoFallido(pool, usuario.id, intentos, bloqueadoHasta);
    if (bloqueadoHasta) {
      throw new ErrorUsuarioBloqueado(bloqueadoHasta);
    }
    throw new ErrorCredencialesInvalidas();
  }

  await usuariosRepositorio.restablecerIntentosFallidos(pool, usuario.id);

  const token = jwt.sign(
    { id: usuario.id, correo: usuario.correo, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRA_EN }
  );

  return {
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
  };
}

module.exports = { iniciarSesion };
