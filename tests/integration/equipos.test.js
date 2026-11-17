const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Registro de equipos (integración)", () => {
  let app;
  let pool;
  let token;
  const sufijo = sufijoUnico();
  const ids = {};
  const serieExpediente = `SN-EQE-${sufijo}`;
  const serieHistorica = `SN-EQH-${sufijo}`;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();
    const q = (sql, p) => pool.query(sql, p).then(([r]) => r);
    const passwordHash = await bcrypt.hash("ClaveSegura123", 10);
    ids.usuario = (
      await q(
        "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
        [`Equipos ${sufijo}`, `equipos-${sufijo}@speal.test`, passwordHash]
      )
    ).insertId;
    token = jwt.sign(
      { id: ids.usuario, correo: `equipos-${sufijo}@speal.test`, rol: "tester" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const cliente = async (letra) =>
      (
        await q(
          `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
           VALUES (?, 'NIT', ?, ?)`,
          [`Cliente Equipos ${letra} ${sufijo}`, `EQ-${letra}-${sufijo}`, ids.usuario]
        )
      ).insertId;
    ids.clienteA = await cliente("A");
    ids.clienteB = await cliente("B");
    const proyecto = async (codigo, clienteId) =>
      (
        await q(
          `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
           VALUES (?, ?, 'Proyecto de equipos', 'instalacion', ?)`,
          [codigo, clienteId, ids.usuario]
        )
      ).insertId;
    ids.proyectoA = await proyecto(`PRY-EQA-${sufijo}`, ids.clienteA);
    ids.proyectoB = await proyecto(`PRY-EQB-${sufijo}`, ids.clienteB);
    app = crearApp();
  });

  afterAll(async () => {
    const q = (sql, p) => pool.query(sql, p);
    const proyectos = [ids.proyectoA, ids.proyectoB];
    await q("DELETE FROM auditoria WHERE usuario_id = ?", [ids.usuario]);
    await q("DELETE FROM notificaciones WHERE usuario_id = ?", [ids.usuario]);
    await q("DELETE FROM reportes_servicio_tecnico WHERE created_by = ?", [ids.usuario]);
    await q("DELETE FROM equipos WHERE cliente_id IN (?, ?)", [ids.clienteA, ids.clienteB]);
    await q("DELETE FROM expedientes_diseno WHERE proyecto_id IN (?)", [proyectos]);
    await q("DELETE FROM proyectos WHERE id IN (?)", [proyectos]);
    await q("DELETE FROM clientes WHERE id IN (?, ?)", [ids.clienteA, ids.clienteB]);
    await q("DELETE FROM usuarios WHERE id = ?", [ids.usuario]);
    await pool.end();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const get = (ruta) => request(app).get(ruta).set(auth());
  const post = (ruta, cuerpo) => request(app).post(ruta).set(auth()).send(cuerpo);
  const put = (ruta, cuerpo) => request(app).put(ruta).set(auth()).send(cuerpo);

  test("un expediente con número de serie registra su equipo solo", async () => {
    const r = await post("/expedientes-diseno", {
      proyecto_id: ids.proyectoA,
      producto_nombre: "Planta PSA 30",
      modelo: "PSA-30",
      numero_serie: serieExpediente,
      responsable_diseno_id: ids.usuario,
    });
    expect(r.status).toBe(201);
    ids.expediente = r.body.expediente.id;

    const lista = await get(`/equipos?numero_serie=${serieExpediente}`);
    expect(lista.status).toBe(200);
    expect(lista.body.equipos).toHaveLength(1);
    expect(lista.body.equipos[0]).toEqual(
      expect.objectContaining({
        origen: "expediente",
        cliente_id: ids.clienteA,
        proyecto_id: ids.proyectoA,
        descripcion: "Planta PSA 30",
        modelo: "PSA-30",
      })
    );
    ids.equipoExpediente = lista.body.equipos[0].id;
  });

  test("registra un equipo histórico (anterior al ERP)", async () => {
    const r = await post("/equipos", {
      numero_serie: serieHistorica,
      cliente_id: ids.clienteA,
      proyecto_id: ids.proyectoA,
      descripcion: "Concentrador O₂ instalado en 2019",
      marca: "Speal",
      fecha_instalacion: "2019-06-01",
    });
    expect(r.status).toBe(201);
    expect(r.body.equipo).toEqual(
      expect.objectContaining({ origen: "historico", fecha_instalacion: "2019-06-01" })
    );
    ids.equipoHistorico = r.body.equipo.id;
  });

  test("rechaza un serial ya registrado y un proyecto de otro cliente", async () => {
    const repetido = await post("/equipos", {
      numero_serie: serieExpediente,
      cliente_id: ids.clienteA,
      proyecto_id: ids.proyectoA,
      descripcion: "Duplicado",
    });
    expect(repetido.status).toBe(409);

    const cruzado = await post("/equipos", {
      numero_serie: `SN-EQX-${sufijo}`,
      cliente_id: ids.clienteB,
      proyecto_id: ids.proyectoA,
      descripcion: "Cruzado",
    });
    expect(cruzado.status).toBe(400);
  });

  test("un equipo histórico recibe reportes y queda su historial", async () => {
    const reporte = await post("/reportes-servicio-tecnico", {
      equipo_numero_serie: serieHistorica,
      cliente_id: ids.clienteA,
      tipo_servicio: "mantenimiento_correctivo",
      fecha_servicio: "2026-11-10",
    });
    expect(reporte.status).toBe(201);
    expect(reporte.body.reporte.proyecto_id).toBe(ids.proyectoA);

    const detalle = await get(`/equipos/${ids.equipoHistorico}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.equipo.reportes).toBe(1);
    expect(detalle.body.equipo.historial_reportes[0].numero_reporte).toBe(
      reporte.body.reporte.numero_reporte
    );
  });

  test("protege la trazabilidad: no cambia el serial con reportes ni edita equipos de expediente", async () => {
    const conReportes = await put(`/equipos/${ids.equipoHistorico}`, {
      numero_serie: `SN-EQN-${sufijo}`,
    });
    expect(conReportes.status).toBe(409);

    const deExpediente = await put(`/equipos/${ids.equipoExpediente}`, { descripcion: "Otro" });
    expect(deExpediente.status).toBe(409);
  });

  test("el expediente no puede tomar el serial de un equipo histórico y, si cambia el suyo, el equipo lo sigue", async () => {
    const choque = await put(`/expedientes-diseno/${ids.expediente}`, {
      numero_serie: serieHistorica,
    });
    expect(choque.status).toBe(409);

    const nuevo = `SN-EQ2-${sufijo}`;
    const cambio = await put(`/expedientes-diseno/${ids.expediente}`, { numero_serie: nuevo });
    expect(cambio.status).toBe(200);
    const equipo = await get(`/equipos/${ids.equipoExpediente}`);
    expect(equipo.body.equipo.numero_serie).toBe(nuevo);
  });
});
