const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");
const { obtenerActividadesPorFase } = require("../../src/dominio/actividadesCatalogoProyecto");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Actividades de proyecto por fase (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let colegaId;
  let clienteId;
  let proyectoId;
  let token;
  const correoUsuario = `proy-actividades-test-${Date.now()}@speal.test`;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();

    const passwordHash = await bcrypt.hash("ClaveSegura123", 10);
    const [usuario] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
      ["Usuario de prueba", correoUsuario, passwordHash]
    );
    usuarioId = usuario.insertId;
    const [colega] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
      ["Colega de prueba", `colega-${correoUsuario}`, passwordHash]
    );
    colegaId = colega.insertId;
    token = jwt.sign(
      { id: usuarioId, correo: correoUsuario, rol: "tester" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const [cliente] = await pool.query(
      `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
       VALUES (?, 'NIT', ?, ?)`,
      ["Cliente para Actividades", `PA-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para Actividades', 'prospecto', ?)`,
      [`PRY-${sufijoUnico()}`, clienteId, usuarioId]
    );
    proyectoId = proyecto.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
    await pool.query("DELETE FROM proyecto_actividades WHERE proyecto_id = ?", [proyectoId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM notificaciones WHERE usuario_id IN (?, ?)", [
      usuarioId,
      colegaId,
    ]);
    await pool.query("DELETE FROM transiciones_estado WHERE proyecto_id = ?", [proyectoId]);
    await pool.query("DELETE FROM usuarios WHERE id IN (?, ?)", [usuarioId, colegaId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let actividadId;

  test("un proyecto recién creado (prospecto) no tiene actividades preestablecidas", async () => {
    const respuesta = await request(app)
      .get(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.actividades).toHaveLength(0);
  });

  test("al avanzar a planeación se siembran las actividades del catálogo de esa fase", async () => {
    const avance = await request(app)
      .patch(`/proyectos/${proyectoId}/estado`)
      .set(autorizacion())
      .send({ estado: "planeacion", observacion: "Aprobado en comité de apertura" });
    expect(avance.status).toBe(200);

    const respuesta = await request(app)
      .get(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.actividades).toHaveLength(obtenerActividadesPorFase("planeacion").length);
    expect(respuesta.body.actividades.every((a) => a.fase === "planeacion")).toBe(true);
    expect(respuesta.body.actividades.every((a) => a.estado === "pendiente")).toBe(true);
    actividadId = respuesta.body.actividades[0].id;
  });

  test("avanzar de fase no duplica actividades ya generadas para esa fase", async () => {
    // reintentar la misma transición (idempotencia del sembrado) no aplica porque
    // el motor de estados no permite reenviar el mismo estado; se valida indirectamente
    // verificando que el conteo de planeación no cambió tras la siguiente transición
    await request(app)
      .patch(`/proyectos/${proyectoId}/estado`)
      .set(autorizacion())
      .send({ estado: "diseno" });

    const respuesta = await request(app)
      .get(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion());
    const dePlaneacion = respuesta.body.actividades.filter((a) => a.fase === "planeacion");
    expect(dePlaneacion).toHaveLength(obtenerActividadesPorFase("planeacion").length);
    const deDiseno = respuesta.body.actividades.filter((a) => a.fase === "diseno");
    expect(deDiseno).toHaveLength(obtenerActividadesPorFase("diseno").length);
  });

  test("marca una actividad como completada y le asigna responsable", async () => {
    const respuesta = await request(app)
      .put(`/proyectos/${proyectoId}/actividades/${actividadId}`)
      .set(autorizacion())
      .send({ estado: "completada", responsable_id: usuarioId });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.actividad.estado).toBe("completada");
    expect(respuesta.body.actividad.responsable_id).toBe(usuarioId);
    expect(respuesta.body.actividad.completada_por).toBe(usuarioId);
    expect(respuesta.body.actividad.completada_en).not.toBeNull();
  });

  test("quita el responsable con null sin tocar lo demás", async () => {
    const respuesta = await request(app)
      .put(`/proyectos/${proyectoId}/actividades/${actividadId}`)
      .set(autorizacion())
      .send({ responsable_id: null });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.actividad.responsable_id).toBeNull();
    expect(respuesta.body.actividad.estado).toBe("completada");

    const vuelta = await request(app)
      .put(`/proyectos/${proyectoId}/actividades/${actividadId}`)
      .set(autorizacion())
      .send({ responsable_id: usuarioId });
    expect(vuelta.body.actividad.responsable_id).toBe(usuarioId);
  });

  test("asigna fecha de inicio y fin a una actividad", async () => {
    const respuesta = await request(app)
      .put(`/proyectos/${proyectoId}/actividades/${actividadId}`)
      .set(autorizacion())
      .send({ fecha_inicio: "2026-11-10", fecha_fin: "2026-11-14" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.actividad.fecha_inicio).toMatch(/^2026-11-10/);
    expect(respuesta.body.actividad.fecha_fin).toMatch(/^2026-11-14/);
  });

  test("rechaza una fecha final anterior a la de inicio", async () => {
    const respuesta = await request(app)
      .put(`/proyectos/${proyectoId}/actividades/${actividadId}`)
      .set(autorizacion())
      .send({ fecha_inicio: "2026-11-10", fecha_fin: "2026-11-01" });
    expect(respuesta.status).toBe(400);
  });

  test("agrega una actividad manual (fuera del catálogo) en la fase actual", async () => {
    const respuesta = await request(app)
      .post(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion())
      .send({ categoria: "Ad-hoc", descripcion: "Actividad agregada manualmente" });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.actividad.fase).toBe("diseno");
    expect(respuesta.body.actividad.estado).toBe("pendiente");
  });

  test("agrega una subactividad en una fase explícita distinta a la actual del proyecto", async () => {
    const respuesta = await request(app)
      .post(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion())
      .send({ categoria: "General", descripcion: "Planeación anticipada", fase: "planeacion" });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.actividad.fase).toBe("planeacion");
  });

  test("rechaza agregar actividades a un proyecto inexistente", async () => {
    const respuesta = await request(app)
      .post("/proyectos/999999999/actividades")
      .set(autorizacion())
      .send({ categoria: "Ad-hoc", descripcion: "No debería crearse" });
    expect(respuesta.status).toBe(404);
  });

  test("elimina (soft-delete) una actividad", async () => {
    const lista = await request(app)
      .get(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion());
    const ultima = lista.body.actividades[lista.body.actividades.length - 1];

    const respuesta = await request(app)
      .delete(`/proyectos/${proyectoId}/actividades/${ultima.id}`)
      .set(autorizacion());
    expect(respuesta.status).toBe(204);

    const listaFinal = await request(app)
      .get(`/proyectos/${proyectoId}/actividades`)
      .set(autorizacion());
    expect(listaFinal.body.actividades.find((a) => a.id === ultima.id)).toBeUndefined();
  });

  describe("estados en curso / finalizado, prioridad y transiciones", () => {
    let actividad;

    beforeAll(async () => {
      const lista = await request(app)
        .get(`/proyectos/${proyectoId}/actividades`)
        .set(autorizacion());
      actividad = lista.body.actividades.find((a) => a.estado === "pendiente");
    });

    const transicionesDe = async (entidad, registroId) =>
      (
        await pool.query(
          "SELECT estado_anterior, estado_nuevo, usuario_id FROM transiciones_estado WHERE entidad = ? AND registro_id = ? ORDER BY id",
          [entidad, registroId]
        )
      )[0];

    test("pasar a en curso guarda iniciada_en y la transición; finalizar guarda completada_en", async () => {
      const enCurso = await request(app)
        .put(`/proyectos/${proyectoId}/actividades/${actividad.id}`)
        .set(autorizacion())
        .send({ estado: "en_curso" });
      expect(enCurso.status).toBe(200);
      expect(enCurso.body.actividad.estado).toBe("en_curso");
      expect(enCurso.body.actividad.iniciada_en).not.toBeNull();
      expect(enCurso.body.actividad.completada_en).toBeNull();

      const finalizada = await request(app)
        .put(`/proyectos/${proyectoId}/actividades/${actividad.id}`)
        .set(autorizacion())
        .send({ estado: "completada" });
      expect(finalizada.body.actividad.completada_en).not.toBeNull();
      // el primer arranque no se pierde al finalizar
      expect(finalizada.body.actividad.iniciada_en).toBe(enCurso.body.actividad.iniciada_en);

      expect(await transicionesDe("actividad", actividad.id)).toEqual([
        { estado_anterior: "pendiente", estado_nuevo: "en_curso", usuario_id: usuarioId },
        { estado_anterior: "en_curso", estado_nuevo: "completada", usuario_id: usuarioId },
      ]);
    });

    test("guardar el mismo estado no agrega transiciones", async () => {
      await request(app)
        .put(`/proyectos/${proyectoId}/actividades/${actividad.id}`)
        .set(autorizacion())
        .send({ estado: "completada" });
      expect(await transicionesDe("actividad", actividad.id)).toHaveLength(2);
    });

    test("marcar Urgente avisa a las personas vinculadas, no a quien la cambia", async () => {
      const lista = await request(app)
        .get(`/proyectos/${proyectoId}/actividades`)
        .set(autorizacion());
      const otra = lista.body.actividades.find((a) => a.estado === "pendiente");
      await request(app)
        .put(`/proyectos/${proyectoId}/actividades/${otra.id}`)
        .set(autorizacion())
        .send({ responsable_id: colegaId });

      const urgente = await request(app)
        .put(`/proyectos/${proyectoId}/actividades/${otra.id}`)
        .set(autorizacion())
        .send({ prioridad: "urgente" });
      expect(urgente.status).toBe(200);
      expect(urgente.body.actividad.prioridad).toBe("urgente");

      const [delColega] = await pool.query(
        "SELECT mensaje, enlace FROM notificaciones WHERE usuario_id = ? AND tipo = 'actividad_prioridad'",
        [colegaId]
      );
      expect(delColega).toHaveLength(1);
      expect(delColega[0].mensaje).toContain("prioridad Urgente");
      expect(delColega[0].enlace).toBe(`#/proyectos/${proyectoId}/actividades/${otra.id}`);

      const [delActor] = await pool.query(
        "SELECT id FROM notificaciones WHERE usuario_id = ? AND tipo = 'actividad_prioridad'",
        [usuarioId]
      );
      expect(delActor).toHaveLength(0);

      // volver a Normal no avisa
      await request(app)
        .put(`/proyectos/${proyectoId}/actividades/${otra.id}`)
        .set(autorizacion())
        .send({ prioridad: "normal" });
      const [despues] = await pool.query(
        "SELECT id FROM notificaciones WHERE usuario_id = ? AND tipo = 'actividad_prioridad'",
        [colegaId]
      );
      expect(despues).toHaveLength(1);
    });

    test("rechaza un estado o una prioridad desconocidos", async () => {
      for (const datos of [{ estado: "terminada" }, { prioridad: "maxima" }]) {
        const respuesta = await request(app)
          .put(`/proyectos/${proyectoId}/actividades/${actividad.id}`)
          .set(autorizacion())
          .send(datos);
        expect(respuesta.status).toBe(400);
      }
    });

    test("el resumen por etapa cuenta avance, vencidas y días en la fase", async () => {
      const lista = await request(app)
        .get(`/proyectos/${proyectoId}/actividades`)
        .set(autorizacion());
      const deDiseno = lista.body.actividades.find(
        (a) => a.fase === "diseno" && a.estado !== "completada"
      );
      await request(app)
        .put(`/proyectos/${proyectoId}/actividades/${deDiseno.id}`)
        .set(autorizacion())
        .send({ fecha_inicio: "2026-01-05", fecha_fin: "2026-01-09" });

      const respuesta = await request(app)
        .get(`/proyectos/${proyectoId}/resumen-etapas`)
        .set(autorizacion());
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.fase_actual).toBe("diseno");
      const porFase = Object.fromEntries(respuesta.body.etapas.map((e) => [e.fase, e]));
      expect(respuesta.body.etapas).toHaveLength(11);
      expect(porFase.planeacion.estado).toBe("completada");
      expect(porFase.planeacion.actividades_finalizadas).toBeGreaterThanOrEqual(1);
      expect(porFase.planeacion.entrada).not.toBeNull();
      expect(porFase.planeacion.salida).not.toBeNull();
      expect(porFase.diseno.estado).toBe("en_curso");
      expect(porFase.diseno.salida).toBeNull();
      expect(porFase.diseno.dias_en_fase).toBeGreaterThanOrEqual(1);
      expect(porFase.diseno.vencidas).toBeGreaterThanOrEqual(1);
      expect(porFase.diseno.plan_dias).toBeGreaterThanOrEqual(5);
      expect(porFase.compras.estado).toBe("por_iniciar");
      expect(porFase.planeacion.urgentes).toBe(0);
    });

    test("la lista de proyectos trae los datos de las tarjetas", async () => {
      const { proyecto } = (await request(app).get(`/proyectos/${proyectoId}`).set(autorizacion()))
        .body;
      const respuesta = await request(app)
        .get(`/proyectos?q=${encodeURIComponent(proyecto.codigo_pry)}`)
        .set(autorizacion());
      const fila = respuesta.body.proyectos.find((p) => p.id === proyectoId);
      expect(fila.actividades_total).toBeGreaterThan(0);
      expect(fila.actividades_finalizadas).toBeGreaterThanOrEqual(1);
      expect(fila.vencidas).toBeGreaterThanOrEqual(1);
      expect(typeof fila.actividad_actual).toBe("string");
      expect(fila.plan_fin).not.toBeNull();
    });

    test("la línea de tiempo muestra el cambio de prioridad de una actividad", async () => {
      const respuesta = await request(app)
        .get(`/proyectos/${proyectoId}/linea-tiempo`)
        .set(autorizacion());
      // más reciente primero: se busca el paso a Urgente (después volvió a Normal)
      const cambio = respuesta.body.eventos.find(
        (e) => e.actividad_cambio_prioridad?.a === "urgente"
      );
      expect(cambio.actividad_cambio_prioridad).toEqual({ de: "normal", a: "urgente" });
      expect(cambio.actividad_id).toBeGreaterThan(0);
    });

    test("los cambios de fase del proyecto quedan en sus transiciones", async () => {
      const fases = (await transicionesDe("proyecto", proyectoId)).map((t) => t.estado_nuevo);
      expect(fases).toEqual(expect.arrayContaining(["planeacion", "diseno"]));
    });
  });
});
