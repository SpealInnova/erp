const MAX_INTENTOS = 5;

// Los códigos consecutivos (PRY-, COT-, OC-, EXP-, RST-, AEE-, ACS-) se
// calculan contando los existentes y luego se insertan: si dos personas crean
// un documento en el mismo instante, ambas pueden calcular el mismo código y
// la segunda fallaba con un error interno. Si la base de datos rechaza el
// código por repetido (su índice único), se calcula otro y se reintenta.
async function insertarConCodigoUnico(indiceUnico, generarCodigo, insertar) {
  for (let intento = 1; ; intento += 1) {
    const codigo = await generarCodigo();
    try {
      return await insertar(codigo);
    } catch (error) {
      const codigoRepetido =
        error &&
        error.code === "ER_DUP_ENTRY" &&
        String(error.sqlMessage || error.message).includes(indiceUnico);
      if (!codigoRepetido || intento >= MAX_INTENTOS) throw error;
    }
  }
}

module.exports = { insertarConCodigoUnico, MAX_INTENTOS };
