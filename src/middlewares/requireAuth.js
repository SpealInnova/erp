const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const encabezado = req.headers.authorization || "";
  const token = encabezado.startsWith("Bearer ") ? encabezado.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

module.exports = { requireAuth };
