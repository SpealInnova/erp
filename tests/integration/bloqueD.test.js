const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD(
  "Riesgos, Cambios y Transferencias de diseño (integración contra BD real)",
  () => {
    let app;
    let pool;
    let usuarioId;
    let clienteId;
    let proyectoId;
    let expedienteId;
    let token;
    const correoUsuario = `bloque-d-test-${Date.now()}@speal.test`;

    beforeAll(async () => {
      process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
      pool = crearPool();

      const passwordHash = await bcrypt.hash("ClaveSegura123", 10);
      const [usuario] = await pool.query(
        "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
        ["Usuario de prueba", correoUsuario, passwordHash]
      );
      usuarioId = usuario.insertId;
      token = jwt.sign(
        { id: usuarioId, correo: correoUsuario, rol: "tester" },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const [cliente] = await pool.query(
        `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
         VALUES (?, 'NIT', ?, ?)`,
        ["Cliente para Bloque D", `BD-TEST-${Date.now()}`, usuarioId]
      );
      clienteId = cliente.insertId;

      const [proyecto] = await pool.query(
        `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
         VALUES (?, ?, 'Proyecto para Bloque D', 'prospecto', ?)`,
        [`PRY-${sufijoUnico()}`, clienteId, usuarioId]
      );
      proyectoId = proyecto.insertId;

      const [expediente] = await pool.query(
        `INSERT INTO expedientes_diseno (codigo_expediente, proyecto_id, producto_nombre, responsable_diseno_id, estado_liberacion)
         VALUES (?, ?, 'Producto de prueba', ?, 'pendiente')`,
        [`EXP-${sufijoUnico()}`, proyectoId, usuarioId]
      );
      expedienteId = expediente.insertId;

      app = crearApp();
    });

    afterAll(async () => {
      await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [usuarioId]);
      await pool.query("DELETE FROM riesgos_diseno WHERE expediente_id = ?", [expedienteId]);
      await pool.query("DELETE FROM cambios_diseno WHERE expediente_id = ?", [expedienteId]);
      await pool.query("DELETE FROM transferencias WHERE expediente_id = ?", [expedienteId]);
      await pool.query("DELETE FROM expedientes_diseno WHERE id = ?", [expedienteId]);
      await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
      await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
      await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
      await pool.end();
    });

    const autorizacion = () => ({ Authorization: `Bearer ${token}` });

    test("rechaza un riesgo con responsable inexistente", async () => {
      const respuesta = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/riesgos-diseno`)
        .set(autorizacion())
        .send({ peligro: "Fuga de presión", responsable_id: 999999999 });
      expect(respuesta.status).toBe(400);
    });

    test("crea un riesgo de diseño", async () => {
      const respuesta = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/riesgos-diseno`)
        .set(autorizacion())
        .send({
          peligro: "Fuga de presión",
          situacion_peligrosa: "Sobrepresión del tanque",
          severidad: "Alta",
          probabilidad: "Baja",
          control: "Válvula de alivio",
          responsable_id: usuarioId,
        });
      expect(respuesta.status).toBe(201);
      expect(respuesta.body.riesgo.peligro).toBe("Fuga de presión");
    });

    test("los cambios de diseño se numeran automáticamente", async () => {
      const primero = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/cambios-diseno`)
        .set(autorizacion())
        .send({ descripcion: "Cambio de material de la carcasa", motivo: "Costo" });
      expect(primero.status).toBe(201);
      expect(primero.body.cambio.numero).toBe(1);
      expect(primero.body.cambio.estado).toBe("pendiente");
    });

    test("al aprobar un cambio, se llenan solos aprobado_por y aprobado_en", async () => {
      const crear = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/cambios-diseno`)
        .set(autorizacion())
        .send({ descripcion: "Segundo cambio" });
      const cambioId = crear.body.cambio.id;

      const aprobar = await request(app)
        .put(`/expedientes-diseno/${expedienteId}/cambios-diseno/${cambioId}`)
        .set(autorizacion())
        .send({ estado: "aprobado" });

      expect(aprobar.status).toBe(200);
      expect(aprobar.body.cambio.estado).toBe("aprobado");
      expect(aprobar.body.cambio.aprobado_por).toBe(usuarioId);
      expect(aprobar.body.cambio.aprobado_en).not.toBeNull();
    });

    test("crea y lista una transferencia", async () => {
      const crear = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/transferencias`)
        .set(autorizacion())
        .send({
          elemento_transferido: "Planos y BOM finales",
          area_receptora: "Producción",
          responsable_id: usuarioId,
          cumple: "si",
        });
      expect(crear.status).toBe(201);

      const listar = await request(app)
        .get(`/expedientes-diseno/${expedienteId}/transferencias`)
        .set(autorizacion());
      expect(listar.status).toBe(200);
      expect(listar.body.transferencias).toHaveLength(1);
    });

    test("al liberar el expediente, ya no se pueden agregar riesgos/cambios/transferencias", async () => {
      await request(app)
        .patch(`/expedientes-diseno/${expedienteId}/estado`)
        .set(autorizacion())
        .send({ estado: "aprobado" });

      const riesgo = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/riesgos-diseno`)
        .set(autorizacion())
        .send({ peligro: "Otro", responsable_id: usuarioId });
      expect(riesgo.status).toBe(409);

      const cambio = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/cambios-diseno`)
        .set(autorizacion())
        .send({ descripcion: "Otro" });
      expect(cambio.status).toBe(409);

      const transferencia = await request(app)
        .post(`/expedientes-diseno/${expedienteId}/transferencias`)
        .set(autorizacion())
        .send({ elemento_transferido: "Otro", responsable_id: usuarioId });
      expect(transferencia.status).toBe(409);
    });
  }
);
