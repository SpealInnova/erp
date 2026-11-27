const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { generarAvisosVencimiento } = require("../../src/servicios/avisosActividades");
const { obtenerTableroGeneral } = require("../../src/servicios/tableroGeneral");
const { HOY_COLOMBIA_SQL } = require("../../src/dominio/fechaColombia");
const { sufijoUnico } = require("../helpers/unico");

jest.mock("../../src/servicios/correo", () => ({
  enviarCorreo: jest.fn().mockResolvedValue(undefined),
}));

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Responsables por etapa del proyecto (integración)", () => {
  let app;
  let pool;
  const ids = {};
  const sufijo = sufijoUnico();
  const ruta = () => `/proyectos/${ids.proyecto}/fase-responsables`;
  const como = (id) => ({
    Authorization: `Bearer ${jwt.sign({ id, rol: "tester" }, process.env.JWT_SECRET)}`,
  });

  async function crearUsuario(nombre, activo = 1) {
    const [r] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, cargo, activo) VALUES (?, ?, 'x', 'tester', 'Jefe de Proyectos', ?)",
      [nombre, `fr-${nombre.replace(/\s/g, "")}-${sufijo}@speal.test`, activo]
    );
    return r.insertId;
  }

  async function crearActividad(fase, responsable, dias) {
    const [r] = await pool.query(
      `INSERT INTO proyecto_actividades
         (proyecto_id, fase, categoria, descripcion, responsable_id, estado, fecha_inicio, fecha_fin)
       VALUES (?, ?, 'General', ?, ?, 'pendiente', ${HOY_COLOMBIA_SQL}, ${HOY_COLOMBIA_SQL} + INTERVAL ? DAY)`,
      [ids.proyecto, fase, `Actividad ${fase} ${sufijo}`, responsable, dias]
    );
    return r.insertId;
  }

  const avisosDe = async (usuarioId) =>
    (
      await pool.query(
        "SELECT tipo, enlace, mensaje FROM notificaciones WHERE usuario_id = ? ORDER BY id",
        [usuarioId]
      )
    )[0];

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();
    ids.jefe = await crearUsuario("Jefe FR");
    ids.ana = await crearUsuario("Ana FR");
    ids.luis = await crearUsuario("Luis FR");
    ids.inactivo = await crearUsuario("Inactivo FR", 0);
    const [cliente] = await pool.query(
      `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
       VALUES ('Cliente FR', 'NIT', ?, ?)`,
      [`FR-${sufijo}`, ids.jefe]
    );
    ids.cliente = cliente.insertId;
    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto FR', 'planeacion', ?)`,
      [`FR-${sufijo}`, ids.cliente, ids.jefe]
    );
    ids.proyecto = proyecto.insertId;
    // diseño: una sin responsable que vence mañana y otra de Luis
    ids.sinResponsable = await crearActividad("diseno", null, 1);
    ids.deLuis = await crearActividad("diseno", ids.luis, 1);
    app = crearApp();
  });

  afterAll(async () => {
    const personas = [ids.jefe, ids.ana, ids.luis, ids.inactivo];
    await pool.query("DELETE FROM notificaciones WHERE usuario_id IN (?)", [personas]);
    await pool.query("DELETE FROM auditoria WHERE usuario_id IN (?)", [personas]);
    await pool.query("DELETE FROM transiciones_estado WHERE proyecto_id = ?", [ids.proyecto]);
    await pool.query("DELETE FROM proyecto_fase_responsables WHERE proyecto_id = ?", [
      ids.proyecto,
    ]);
    await pool.query("DELETE FROM proyecto_actividades WHERE proyecto_id = ?", [ids.proyecto]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [ids.proyecto]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [ids.cliente]);
    await pool.query("DELETE FROM usuarios WHERE id IN (?)", [personas]);
    await pool.end();
  });

  test("pide sesión", async () => {
    expect((await request(app).get(ruta())).status).toBe(401);
  });

  test("asigna a varias personas a una etapa, con aviso y auditoría", async () => {
    for (const persona of [ids.ana, ids.luis]) {
      const r = await request(app)
        .post(ruta())
        .set(como(ids.jefe))
        .send({ fase: "diseno", usuario_id: persona });
      expect(r.status).toBe(201);
      expect(r.body.responsable).toMatchObject({ fase: "diseno", usuario_id: persona });
    }
    ids.responsableAna = (
      await request(app).get(ruta()).set(como(ids.jefe))
    ).body.responsables.find((r) => r.usuario_id === ids.ana).id;

    const lista = await request(app).get(ruta()).set(como(ids.ana));
    expect(lista.status).toBe(200);
    expect(lista.body.responsables.map((r) => [r.fase, r.usuario_nombre])).toEqual([
      ["diseno", "Ana FR"],
      ["diseno", "Luis FR"],
    ]);
    expect(await avisosDe(ids.ana)).toEqual([
      expect.objectContaining({
        tipo: "responsable_etapa",
        mensaje: `Te asignaron como responsable de la etapa "Diseño" del proyecto FR-${sufijo}.`,
      }),
    ]);
    const [auditoria] = await pool.query(
      "SELECT accion FROM auditoria WHERE tabla = 'proyecto_fase_responsables' AND registro_id = ?",
      [ids.responsableAna]
    );
    expect(auditoria.map((a) => a.accion)).toEqual(["crear"]);
  });

  test("rechaza repetidos, personas inactivas o inexistentes y etapas que no existen", async () => {
    const asignar = (datos) => request(app).post(ruta()).set(como(ids.jefe)).send(datos);
    expect((await asignar({ fase: "diseno", usuario_id: ids.ana })).status).toBe(409);
    expect((await asignar({ fase: "diseno", usuario_id: ids.inactivo })).status).toBe(400);
    expect((await asignar({ fase: "diseno", usuario_id: 99999999 })).status).toBe(400);
    expect((await asignar({ fase: "cancelado", usuario_id: ids.ana })).status).toBe(400);
    const otroProyecto = await request(app)
      .post("/proyectos/99999999/fase-responsables")
      .set(como(ids.jefe))
      .send({ fase: "diseno", usuario_id: ids.ana });
    expect(otroProyecto.status).toBe(404);
  });

  test("la actividad sin responsable de su etapa le aparece en pendientes y le avisa", async () => {
    const r = await request(app).get("/actividades/pendientes").set(como(ids.ana));
    const recibidas = r.body.actividades.map((a) => a.id);
    expect(recibidas).toContain(ids.sinResponsable);
    expect(recibidas).not.toContain(ids.deLuis);

    await generarAvisosVencimiento(pool);
    const enlace = `#/proyectos/${ids.proyecto}/actividades/${ids.sinResponsable}`;
    // a la responsable de la etapa y, como antes, al responsable del proyecto
    for (const persona of [ids.ana, ids.jefe]) {
      expect(await avisosDe(persona)).toContainEqual(
        expect.objectContaining({ tipo: "actividad_por_vencer", enlace })
      );
    }
    // Luis también es responsable de la etapa: recibe la sin responsable y la suya, una vez cada una
    const deLuis = (await avisosDe(ids.luis)).filter((a) => a.tipo === "actividad_por_vencer");
    expect(deLuis.map((a) => a.enlace).sort()).toEqual(
      [enlace, `#/proyectos/${ids.proyecto}/actividades/${ids.deLuis}`].sort()
    );
  });

  test("ve el proyecto en su inicio", async () => {
    const tablero = await obtenerTableroGeneral(pool, ids.ana);
    expect(tablero.proyectos.map((p) => p.id)).toContain(ids.proyecto);
  });

  test("el resumen por etapa trae sus responsables", async () => {
    const r = await request(app)
      .get(`/proyectos/${ids.proyecto}/resumen-etapas`)
      .set(como(ids.ana));
    const diseno = r.body.etapas.find((e) => e.fase === "diseno");
    expect(diseno.responsables.map((x) => x.nombre)).toEqual(["Ana FR", "Luis FR"]);
    expect(r.body.etapas.find((e) => e.fase === "compras").responsables).toEqual([]);
  });

  test("cuando el proyecto entra a la etapa, avisa a sus responsables", async () => {
    // un responsable de etapa puede cambiar la fase, como cualquiera con sesión
    const r = await request(app)
      .patch(`/proyectos/${ids.proyecto}/estado`)
      .set(como(ids.ana))
      .send({ estado: "diseno" });
    expect(r.status).toBe(200);
    for (const persona of [ids.ana, ids.luis]) {
      expect(await avisosDe(persona)).toContainEqual(
        expect.objectContaining({
          tipo: "proyecto_cambio_fase",
          mensaje: `El proyecto FR-${sufijo} entró a la etapa "Diseño", de la que eres responsable.`,
        })
      );
    }
  });

  test("se quita y se puede volver a asignar", async () => {
    const quitar = await request(app).delete(`${ruta()}/${ids.responsableAna}`).set(como(ids.jefe));
    expect(quitar.status).toBe(204);
    const lista = await request(app).get(ruta()).set(como(ids.jefe));
    expect(lista.body.responsables.map((x) => x.usuario_id)).toEqual([ids.luis]);
    expect(
      (await request(app).delete(`${ruta()}/${ids.responsableAna}`).set(como(ids.jefe))).status
    ).toBe(404);

    const otraVez = await request(app)
      .post(ruta())
      .set(como(ids.jefe))
      .send({ fase: "diseno", usuario_id: ids.ana });
    expect(otraVez.status).toBe(201);
    expect(otraVez.body.responsable.id).toBe(ids.responsableAna);
  });
});
