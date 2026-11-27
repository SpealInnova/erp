const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Listado maestro de servicios FO-ST-006 (integración)", () => {
  let app;
  let pool;
  let token;
  const ids = {};
  const sufijo = sufijoUnico();
  const serie = `SN-LM-${sufijo}`;

  async function crearUsuario(nombre) {
    const [r] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
      [nombre, `lm-${nombre.replace(/\s/g, "")}-${sufijo}@speal.test`, await bcrypt.hash("x", 4)]
    );
    return r.insertId;
  }

  async function crearReporte(n, datos) {
    const [r] = await pool.query(
      `INSERT INTO reportes_servicio_tecnico
         (numero_reporte, equipo_numero_serie, cliente_id, proyecto_id, tipo_servicio, en_garantia,
          tecnico_responsable_id, motivo, fecha_servicio, hora_inicio, hora_fin, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `LM-${sufijo}-${n}`,
        serie,
        ids.cliente,
        ids.proyecto,
        datos.tipo,
        datos.garantia ? 1 : 0,
        datos.tecnico,
        datos.motivo || null,
        datos.fecha,
        datos.inicio || null,
        datos.fin || null,
        ids.creador,
      ]
    );
    return r.insertId;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();
    ids.creador = await crearUsuario("Creador LM");
    ids.tecnicoA = await crearUsuario("Tecnico A LM");
    ids.tecnicoB = await crearUsuario("Tecnico B LM");
    token = jwt.sign({ id: ids.creador, rol: "tester" }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const [cliente] = await pool.query(
      `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
       VALUES (?, 'NIT', ?, ?)`,
      [`Cliente LM ${sufijo}`, `LM-${sufijo}`, ids.creador]
    );
    ids.cliente = cliente.insertId;
    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto LM', 'entrega', ?)`,
      [`PRY-LM-${sufijo}`, ids.cliente, ids.creador]
    );
    ids.proyecto = proyecto.insertId;
    await pool.query(
      `INSERT INTO equipos (numero_serie, cliente_id, proyecto_id, descripcion, origen)
       VALUES (?, ?, ?, 'Concentrador LM', 'historico')`,
      [serie, ids.cliente, ids.proyecto]
    );
    ids.r1 = await crearReporte(1, {
      tipo: "mantenimiento_preventivo",
      tecnico: ids.tecnicoA,
      fecha: "2026-03-10",
      inicio: "08:00:00",
      fin: "09:30:00",
      motivo: "Revisión; semestral",
    });
    ids.r2 = await crearReporte(2, {
      tipo: "garantia",
      garantia: true,
      tecnico: ids.tecnicoB,
      fecha: "2026-05-20",
      motivo: "=fórmula",
    });
    ids.r3 = await crearReporte(3, {
      tipo: "mantenimiento_correctivo",
      tecnico: ids.tecnicoA,
      fecha: "2026-07-01",
    });
    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM reportes_servicio_tecnico WHERE proyecto_id = ?", [ids.proyecto]);
    await pool.query("DELETE FROM equipos WHERE numero_serie = ?", [serie]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [ids.proyecto]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [ids.cliente]);
    await pool.query("DELETE FROM usuarios WHERE id IN (?)", [
      [ids.creador, ids.tecnicoA, ids.tecnicoB],
    ]);
    await pool.end();
  });

  const listar = (filtros) =>
    request(app)
      .get("/listado-maestro-servicios")
      .query({ cliente_id: ids.cliente, ...filtros })
      .set({ Authorization: `Bearer ${token}` });

  test("pide sesión", async () => {
    const r = await request(app).get("/listado-maestro-servicios");
    expect(r.status).toBe(401);
  });

  test("lista los servicios del cliente, del más reciente al más antiguo, con sus nombres", async () => {
    const r = await listar({});
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(3);
    expect(r.body.servicios.map((s) => s.id)).toEqual([ids.r3, ids.r2, ids.r1]);
    const primero = r.body.servicios[2];
    expect(primero).toMatchObject({
      equipo_descripcion: "Concentrador LM",
      tecnico_nombre: "Tecnico A LM",
      tipo_servicio_texto: "Mantenimiento preventivo",
      duracion_minutos: 90,
      proyecto_codigo: `PRY-LM-${sufijo}`,
    });
  });

  test("filtra por fechas, tipo, técnico, garantía y texto", async () => {
    const ids_ = async (filtros) => (await listar(filtros)).body.servicios.map((s) => s.id);
    expect(await ids_({ desde: "2026-05-01", hasta: "2026-06-30" })).toEqual([ids.r2]);
    expect(await ids_({ tipo_servicio: "mantenimiento_correctivo" })).toEqual([ids.r3]);
    expect(await ids_({ tecnico_id: ids.tecnicoA })).toEqual([ids.r3, ids.r1]);
    expect(await ids_({ en_garantia: "si" })).toEqual([ids.r2]);
    expect(await ids_({ en_garantia: "no" })).toEqual([ids.r3, ids.r1]);
    expect(await ids_({ q: "Tecnico B" })).toEqual([ids.r2]);
    expect(await ids_({ q: `LM-${sufijo}-1` })).toEqual([ids.r1]);
  });

  test("rechaza filtros inválidos", async () => {
    expect((await listar({ tipo_servicio: "otro" })).status).toBe(400);
    expect((await listar({ desde: "10/03/2026" })).status).toBe(400);
  });

  test("descarga el CSV con los mismos filtros, listo para Excel", async () => {
    const r = await request(app)
      .get("/listado-maestro-servicios/csv")
      .query({ cliente_id: ids.cliente })
      .set({ Authorization: `Bearer ${token}` });
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/csv/);
    expect(r.headers["content-disposition"]).toMatch(
      /attachment; filename="listado-maestro-servicios-\d{4}-\d{2}-\d{2}\.csv"/
    );
    expect(r.headers["x-total-servicios"]).toBe("3");
    expect(r.text.startsWith("\uFEFF")).toBe(true);
    const lineas = r.text.replace("\uFEFF", "").trim().split("\r\n");
    expect(lineas).toHaveLength(4);
    expect(lineas[0]).toBe(
      "Número;Versión;Fecha de servicio;Cliente;N° de serie;Equipo;Proyecto;Tipo de servicio;En garantía;Técnico;Hora de inicio;Hora de fin;Duración (min);Motivo"
    );
    const r1 = lineas.find((l) => l.startsWith(`LM-${sufijo}-1;`));
    expect(r1).toContain(";10/03/2026;");
    expect(r1).toContain(";Mantenimiento preventivo;No;Tecnico A LM;08:00;09:30;90;");
    expect(r1.endsWith('"Revisión; semestral"')).toBe(true);
    const r2 = lineas.find((l) => l.startsWith(`LM-${sufijo}-2;`));
    expect(r2).toContain(";Garantía;Sí;Tecnico B LM;");
    expect(r2.endsWith(";'=fórmula")).toBe(true);
  });
});
