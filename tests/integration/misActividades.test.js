const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { generarAvisosVencimiento } = require("../../src/servicios/avisosActividades");

jest.mock("../../src/servicios/correo", () => ({
  enviarCorreo: jest.fn().mockResolvedValue(undefined),
}));
const correo = require("../../src/servicios/correo");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Actividades pendientes y avisos de vencimiento (integración)", () => {
  let app;
  let pool;
  let jefeId;
  let otroId;
  let clienteId;
  let proyectoId;
  let proyectoCerradoId;
  let token;
  const ids = {};
  const sufijo = Date.now();
  const corto = String(sufijo).slice(-8); // codigo_pry es corto

  async function crearUsuario(nombre) {
    const [r] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, cargo, activo) VALUES (?, ?, 'x', 'tester', 'Jefe de Proyectos', 1)",
      [nombre, `${nombre.toLowerCase().replace(/\s/g, ".")}-${sufijo}@speal.test`]
    );
    return r.insertId;
  }

  async function crearProyecto(codigo, estado) {
    const [r] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, ?, ?, ?)`,
      [codigo, clienteId, `Proyecto ${codigo}`, estado, jefeId]
    );
    return r.insertId;
  }

  // dias: fecha de fin relativa a hoy según la BD (evita desfases de zona).
  async function crearActividad(clave, { proyecto, responsable, dias, estado = "pendiente" }) {
    const [r] = await pool.query(
      `INSERT INTO proyecto_actividades
         (proyecto_id, fase, categoria, descripcion, responsable_id, estado, fecha_inicio, fecha_fin)
       VALUES (?, 'planeacion', 'General', ?, ?, ?,
               IF(? IS NULL, NULL, CURDATE() + INTERVAL ? DAY - INTERVAL 2 DAY),
               IF(? IS NULL, NULL, CURDATE() + INTERVAL ? DAY))`,
      [proyecto, `Actividad ${clave} ${sufijo}`, responsable, estado, dias, dias, dias, dias]
    );
    ids[clave] = r.insertId;
  }

  async function avisosDe(usuarioId) {
    const [filas] = await pool.query(
      "SELECT tipo, enlace, mensaje FROM notificaciones WHERE usuario_id = ? ORDER BY id",
      [usuarioId]
    );
    return filas;
  }

  const enlace = (clave, proyecto = proyectoId) =>
    `#/proyectos/${proyecto}/actividades/${ids[clave]}`;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();
    jefeId = await crearUsuario("Jefe Avisos");
    otroId = await crearUsuario("Otro Avisos");
    token = jwt.sign(
      { id: jefeId, correo: "jefe@speal.test", rol: "tester" },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );
    const [cliente] = await pool.query(
      `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
       VALUES ('Cliente Avisos', 'NIT', ?, ?)`,
      [`AVISOS-${sufijo}`, jefeId]
    );
    clienteId = cliente.insertId;
    proyectoId = await crearProyecto(`AV-${corto}`, "planeacion");
    proyectoCerradoId = await crearProyecto(`AVC-${corto}`, "cerrado");

    const p = proyectoId;
    await crearActividad("porVencer", { proyecto: p, responsable: jefeId, dias: 1 });
    await crearActividad("venceHoySinResp", { proyecto: p, responsable: null, dias: 0 });
    await crearActividad("vencida", { proyecto: p, responsable: jefeId, dias: -2 });
    await crearActividad("vencidaVieja", { proyecto: p, responsable: jefeId, dias: -30 });
    await crearActividad("conPlazo", { proyecto: p, responsable: jefeId, dias: 10 });
    await crearActividad("sinFechas", { proyecto: p, responsable: jefeId, dias: null });
    await crearActividad("completada", {
      proyecto: p,
      responsable: jefeId,
      dias: 0,
      estado: "completada",
    });
    await crearActividad("deOtro", { proyecto: p, responsable: otroId, dias: 0 });
    await crearActividad("proyectoCerrado", {
      proyecto: proyectoCerradoId,
      responsable: jefeId,
      dias: 0,
    });

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM notificaciones WHERE usuario_id IN (?, ?)", [jefeId, otroId]);
    await pool.query("DELETE FROM proyecto_actividades WHERE proyecto_id IN (?, ?)", [
      proyectoId,
      proyectoCerradoId,
    ]);
    await pool.query("DELETE FROM proyectos WHERE id IN (?, ?)", [proyectoId, proyectoCerradoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id IN (?, ?)", [jefeId, otroId]);
    await pool.end();
  });

  test("exige sesión", async () => {
    const r = await request(app).get("/actividades/pendientes");
    expect(r.status).toBe(401);
  });

  test("lista lo asignado al usuario y lo sin responsable de sus proyectos", async () => {
    const r = await request(app)
      .get("/actividades/pendientes")
      .set({ Authorization: `Bearer ${token}` });
    expect(r.status).toBe(200);
    expect(r.body.dias_aviso).toBe(3);
    const recibidas = r.body.actividades.map((a) => a.id);
    ["porVencer", "venceHoySinResp", "vencida", "vencidaVieja", "conPlazo", "sinFechas"].forEach(
      (clave) => expect(recibidas).toContain(ids[clave])
    );
    ["completada", "deOtro", "proyectoCerrado"].forEach((clave) =>
      expect(recibidas).not.toContain(ids[clave])
    );
    const una = r.body.actividades.find((a) => a.id === ids.porVencer);
    expect(una.codigo_pry).toBe(`AV-${corto}`);
    expect(String(una.fecha_fin)).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  test("al consultar, avisa en la campana de lo por vencer y lo recién vencido, sin correo", async () => {
    const avisos = await avisosDe(jefeId);
    const porEnlace = Object.fromEntries(avisos.map((a) => [a.enlace, a]));

    expect(porEnlace[enlace("porVencer")].tipo).toBe("actividad_por_vencer");
    expect(porEnlace[enlace("porVencer")].mensaje).toContain("vence mañana");
    expect(porEnlace[enlace("venceHoySinResp")].mensaje).toContain("vence hoy");
    expect(porEnlace[enlace("vencida")].tipo).toBe("actividad_vencida");
    expect(porEnlace[enlace("vencida")].mensaje).toContain("hace 2 días");
    expect(porEnlace[enlace("vencidaVieja")]).toBeUndefined();
    expect(porEnlace[enlace("conPlazo")]).toBeUndefined();
    expect(porEnlace[enlace("completada")]).toBeUndefined();
    expect(porEnlace[enlace("proyectoCerrado", proyectoCerradoId)]).toBeUndefined();
    expect(avisos).toHaveLength(3);
    expect(correo.enviarCorreo).not.toHaveBeenCalled();
  });

  test("no repite avisos y la revisión general alcanza a los demás usuarios", async () => {
    await request(app)
      .get("/actividades/pendientes")
      .set({ Authorization: `Bearer ${token}` });
    await generarAvisosVencimiento(pool);
    expect(await avisosDe(jefeId)).toHaveLength(3);

    const delOtro = await avisosDe(otroId);
    expect(delOtro.map((a) => a.enlace)).toContain(enlace("deOtro"));
    await generarAvisosVencimiento(pool);
    expect(await avisosDe(otroId)).toHaveLength(delOtro.length);
  });
});
