// Ambos responden 403 (no 401): el usuario sigue autenticado, solo que su
// cargo no le permite la acción. Un 401 cerraría su sesión en el frontend.
class ErrorSinPermiso extends Error {
  constructor(mensaje = "Tu cargo no tiene permiso para esta acción") {
    super(mensaje);
  }
}

class ErrorAutoAprobacion extends Error {
  constructor(
    mensaje = "No puedes aprobar un documento que tú mismo creaste: debe aprobarlo otra persona"
  ) {
    super(mensaje);
  }
}

module.exports = { ErrorSinPermiso, ErrorAutoAprobacion };
