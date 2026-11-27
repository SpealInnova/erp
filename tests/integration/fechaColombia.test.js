const { crearPool } = require("../../src/config/db");
const { HOY_COLOMBIA_SQL, hoyEnColombia } = require("../../src/dominio/fechaColombia");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

const dia = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describirSiHayBD("Hoy de Colombia en la base (integración)", () => {
  let pool;

  beforeAll(() => {
    pool = crearPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  // Con otra zona en la sesión de MySQL, el SQL sigue dando el día de Colombia
  // y coincide con el que calcula el servidor en JavaScript.
  test.each(["+00:00", "+09:00", "-05:00"])("con la sesión en %s", async (zona) => {
    const conexion = await pool.getConnection();
    try {
      await conexion.query("SET time_zone = ?", [zona]);
      const [[fila]] = await conexion.query(
        `SELECT DATE_FORMAT(${HOY_COLOMBIA_SQL}, '%Y-%m-%d') AS hoy`
      );
      expect(fila.hoy).toBe(dia(hoyEnColombia()));
    } finally {
      await conexion.query("SET time_zone = DEFAULT");
      conexion.release();
    }
  });
});
