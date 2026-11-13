const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

// Reportes de servicio y actas deben quedar conectados con su proyecto: el
// cliente es el del proyecto, los equipos son del proyecto y un acta de cierre
// solo cierra un acta de entrega del mismo proyecto.
describirSiHayBD("Coherencia de documentos con su proyecto (integración)", () => {
  let app;
  let pool;
  let token;
  const sufijo = sufijoUnico();
  const ids = {};
  const codigoP1 = `PRY-CA-${sufijo}`;
  const codigoP2 = `PRY-CB-${sufijo}`;
  const serie1 = `SN-CA1-${sufijo}`;
  const serie2 = `SN-CB2-${sufijo}`;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();
    const passwordHash = await bcrypt.hash("ClaveSegura123", 10);
    const [usuario] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
      [`Coherencia ${sufijo}`, `coherencia-${sufijo}@speal.test`, passwordHash]
    );
    ids.usuario = usuario.insertId;
    token = jwt.sign(
      { id: ids.usuario, correo: `coherencia-${sufijo}@speal.test`, rol: "tester" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const crearCliente = async (letra) => {
      const [r] = await pool.query(
        `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
         VALUES (?, 'NIT', ?, ?)`,
        [`Cliente ${letra} ${sufijo}`, `COH-${letra}-${sufijo}`, ids.usuario]
      );
      return r.insertId;
    };
    ids.clienteA = await crearCliente("A");
    ids.clienteB = await crearCliente("B");

    const crearProyecto = async (codigo, clienteId) => {
      const [r] = await pool.query(
        `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
         VALUES (?, ?, 'Proyecto de coherencia', 'instalacion', ?)`,
        [codigo, clienteId, ids.usuario]
      );
      return r.insertId;
    };
    ids.p1 = await crearProyecto(codigoP1, ids.clienteA);
    ids.p2 = await crearProyecto(codigoP2, ids.clienteB);

    const crearExpediente = async (codigo, proyectoId, serie) => {
      const [r] = await pool.query(
        `INSERT INTO expedientes_diseno (codigo_expediente, proyecto_id, producto_nombre, numero_serie, responsable_diseno_id, estado_liberacion)
         VALUES (?, ?, 'Planta', ?, ?, 'aprobado')`,
        [codigo, proyectoId, serie, ids.usuario]
      );
      return r.insertId;
    };
    ids.e1 = await crearExpediente(`EXP-CA-${sufijo}`, ids.p1, serie1);
    ids.e2 = await crearExpediente(`EXP-CB-${sufijo}`, ids.p2, serie2);

    app = crearApp();
  });

  afterAll(async () => {
    const proyectos = [ids.p1, ids.p2];
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [ids.usuario]);
    await pool.query("DELETE FROM notificaciones WHERE usuario_id = ?", [ids.usuario]);
    await pool.query(
      "DELETE i FROM acta_items_verificados i JOIN actas_cierre_satisfaccion a ON a.id = i.acta_id WHERE a.proyecto_id IN (?)",
      [proyectos]
    );
    await pool.query("DELETE FROM actas_cierre_satisfaccion WHERE proyecto_id IN (?)", [proyectos]);
    await pool.query(
      "DELETE i FROM acta_entrega_items i JOIN actas_entrega_equipos a ON a.id = i.acta_id WHERE a.proyecto_id IN (?)",
      [proyectos]
    );
    await pool.query("DELETE FROM actas_entrega_equipos WHERE proyecto_id IN (?)", [proyectos]);
    await pool.query("DELETE FROM reportes_servicio_tecnico WHERE created_by = ?", [ids.usuario]);
    await pool.query("DELETE FROM expedientes_diseno WHERE id IN (?, ?)", [ids.e1, ids.e2]);
    await pool.query("DELETE FROM proyectos WHERE id IN (?)", [proyectos]);
    await pool.query("DELETE FROM clientes WHERE id IN (?, ?)", [ids.clienteA, ids.clienteB]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [ids.usuario]);
    await pool.end();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const post = (ruta, cuerpo) => request(app).post(ruta).set(auth()).send(cuerpo);
  const put = (ruta, cuerpo) => request(app).put(ruta).set(auth()).send(cuerpo);

  describe("Reportes de servicio técnico", () => {
    test("rechaza un proyecto distinto al del equipo y nombra ambos proyectos", async () => {
      const r = await post("/reportes-servicio-tecnico", {
        equipo_numero_serie: serie1,
        cliente_id: ids.clienteB,
        proyecto_id: ids.p2,
        tipo_servicio: "inspeccion",
      });
      expect(r.status).toBe(400);
      expect(r.body.error).toContain(codigoP1);
      expect(r.body.error).toContain(codigoP2);
    });

    test("rechaza un cliente distinto al del proyecto del equipo", async () => {
      const r = await post("/reportes-servicio-tecnico", {
        equipo_numero_serie: serie1,
        cliente_id: ids.clienteB,
        tipo_servicio: "inspeccion",
      });
      expect(r.status).toBe(400);
      expect(r.body.error).toContain(codigoP1);
    });

    test("sin proyecto indicado, toma el del equipo; al editar valida solo si cambian los enlaces", async () => {
      const creado = await post("/reportes-servicio-tecnico", {
        equipo_numero_serie: serie1,
        cliente_id: ids.clienteA,
        tipo_servicio: "mantenimiento_preventivo",
      });
      expect(creado.status).toBe(201);
      expect(creado.body.reporte.proyecto_id).toBe(ids.p1);
      const id = creado.body.reporte.id;

      const otroCliente = await put(`/reportes-servicio-tecnico/${id}`, {
        cliente_id: ids.clienteB,
      });
      expect(otroCliente.status).toBe(400);

      const soloHallazgos = await put(`/reportes-servicio-tecnico/${id}`, {
        hallazgos: "Sin novedad",
      });
      expect(soloHallazgos.status).toBe(200);

      // con otro equipo y su cliente, el proyecto sigue al equipo nuevo
      const otroEquipo = await put(`/reportes-servicio-tecnico/${id}`, {
        equipo_numero_serie: serie2,
        cliente_id: ids.clienteB,
      });
      expect(otroEquipo.status).toBe(200);
      expect(otroEquipo.body.reporte.proyecto_id).toBe(ids.p2);
    });
  });

  describe("Actas de entrega", () => {
    const acta = (extra) => ({
      objeto: "Entrega de planta",
      receptor_nombre: "Jefe de mantenimiento",
      items: [
        { descripcion_equipo: "Planta PSA", cantidad: 1, numero_serie: serie1, cumple: "si" },
      ],
      ...extra,
    });

    test("rechaza un cliente distinto al del proyecto", async () => {
      const r = await post(
        "/actas-entrega-equipos",
        acta({ proyecto_id: ids.p1, cliente_id: ids.clienteB })
      );
      expect(r.status).toBe(400);
      expect(r.body.error).toContain(codigoP1);
    });

    test("rechaza un equipo de otro proyecto sin dejar el acta a medias", async () => {
      const [[antes]] = await pool.query(
        "SELECT COUNT(*) AS n FROM actas_entrega_equipos WHERE proyecto_id = ?",
        [ids.p1]
      );
      const r = await post(
        "/actas-entrega-equipos",
        acta({
          proyecto_id: ids.p1,
          cliente_id: ids.clienteA,
          items: [
            { descripcion_equipo: "Planta", cantidad: 1, numero_serie: serie2, cumple: "si" },
          ],
        })
      );
      expect(r.status).toBe(400);
      expect(r.body.error).toContain(serie2);
      expect(r.body.error).toContain(codigoP2);
      const [[despues]] = await pool.query(
        "SELECT COUNT(*) AS n FROM actas_entrega_equipos WHERE proyecto_id = ?",
        [ids.p1]
      );
      expect(despues.n).toBe(antes.n);
    });

    test("acepta equipos del proyecto y seriales sin expediente; al cambiar de proyecto revalida", async () => {
      const r = await post(
        "/actas-entrega-equipos",
        acta({
          proyecto_id: ids.p1,
          cliente_id: ids.clienteA,
          items: [
            { descripcion_equipo: "Planta", cantidad: 1, numero_serie: serie1, cumple: "si" },
            {
              descripcion_equipo: "Kit de filtros",
              cantidad: 2,
              numero_serie: `ACC-${sufijo}`,
              cumple: "si",
            },
          ],
        })
      );
      expect(r.status).toBe(201);
      ids.actaEntrega = r.body.acta.id;
      ids.numeroActaEntrega = r.body.acta.numero_acta;
      expect(r.body.acta.items.find((i) => i.numero_serie === serie1).expediente_id).toBe(ids.e1);

      // pasarla al otro proyecto (con su cliente) choca con el equipo ya registrado
      const mover = await put(`/actas-entrega-equipos/${ids.actaEntrega}`, {
        proyecto_id: ids.p2,
        cliente_id: ids.clienteB,
      });
      expect(mover.status).toBe(400);
      expect(mover.body.error).toContain(serie1);
    });
  });

  describe("Actas de cierre", () => {
    const cierre = (extra) => ({
      tipo_entrega: "venta",
      tipo_documento_referencia: "contrato",
      objeto: "Cierre a satisfacción",
      receptor_cliente_nombre: "Gerente",
      items: [{ elemento: "Planta PSA", cantidad: 1, cumple: "si" }],
      ...extra,
    });

    test("rechaza enlazar el acta de entrega de otro proyecto", async () => {
      const r = await post(
        "/actas-cierre-satisfaccion",
        cierre({ proyecto_id: ids.p2, cliente_id: ids.clienteB, acta_entrega_id: ids.actaEntrega })
      );
      expect(r.status).toBe(400);
      expect(r.body.error).toContain(ids.numeroActaEntrega);
      expect(r.body.error).toContain(codigoP1);
    });

    test("rechaza un cliente distinto al del proyecto", async () => {
      const r = await post(
        "/actas-cierre-satisfaccion",
        cierre({ proyecto_id: ids.p1, cliente_id: ids.clienteB })
      );
      expect(r.status).toBe(400);
    });

    test("crea el cierre del mismo proyecto y no permite moverlo a otro con esa acta de entrega", async () => {
      const r = await post(
        "/actas-cierre-satisfaccion",
        cierre({ proyecto_id: ids.p1, cliente_id: ids.clienteA, acta_entrega_id: ids.actaEntrega })
      );
      expect(r.status).toBe(201);

      const mover = await put(`/actas-cierre-satisfaccion/${r.body.acta.id}`, {
        proyecto_id: ids.p2,
        cliente_id: ids.clienteB,
      });
      expect(mover.status).toBe(400);
      expect(mover.body.error).toContain(ids.numeroActaEntrega);
    });
  });
});
