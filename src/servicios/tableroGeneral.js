const usuariosRepositorio = require("../repositorios/usuariosRepositorio");
const proyectoActividadesRepositorio = require("../repositorios/proyectoActividadesRepositorio");
const tareasRepositorio = require("../repositorios/tareasRepositorio");
const notificacionesRepositorio = require("../repositorios/notificacionesRepositorio");
const repo = require("../repositorios/tableroGeneralRepositorio");
const { tienePermiso } = require("../dominio/permisos");

const UN_DIA_MS = 24 * 60 * 60 * 1000;

function soloFecha(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  d.setHours(0, 0, 0, 0);
  return d;
}

function aTexto(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Un pendiente es "para hoy" si vence hoy, si está en curso o si hoy está
// entre su inicio y su fin.
function esParaHoy(item, hoy) {
  if (item.estado === "en_curso") return true;
  const inicio = soloFecha(item.fecha_inicio);
  const fin = soloFecha(item.fecha_fin);
  if (!fin) return false;
  return fin.getTime() === hoy.getTime() || (inicio && inicio <= hoy && fin >= hoy);
}

// Tablero general: lo que le toca a cada persona, visible para todos los
// perfiles (el gerencial queda para los cargos directivos).
async function obtenerTableroGeneral(pool, usuarioId, { hoy = new Date() } = {}) {
  const hoyFecha = soloFecha(hoy);
  const usuario = await usuariosRepositorio.buscarPorId(pool, usuarioId);
  const [actividades, tareas, proyectos, cumplimiento, finalizadas, porAprobar, avisos] =
    await Promise.all([
      proyectoActividadesRepositorio.listarPendientesDeUsuario(pool, usuarioId),
      tareasRepositorio.listarDeUsuario(pool, usuarioId, { origen: "todas", estado: "abiertas" }),
      repo.proyectosDeUsuario(pool, usuarioId),
      repo.cumplimientoDelMes(pool, usuarioId),
      repo.finalizadasDeLaSemana(pool, usuarioId),
      repo.contarPorAprobar(pool, usuarioId),
      notificacionesRepositorio.listarPorUsuario(pool, usuarioId, 5),
    ]);

  // Pendientes propios: actividades (asignadas o sin responsable de sus
  // proyectos) y tareas de las que es responsable.
  const pendientes = [
    ...actividades.map((a) => ({
      tipo: "actividad",
      id: a.id,
      titulo: a.descripcion,
      estado: a.estado,
      prioridad: a.prioridad,
      fecha_inicio: a.fecha_inicio,
      fecha_fin: a.fecha_fin,
      origen: `${a.codigo_pry} · ${a.nombre_proyecto}`,
      enlace: `#/proyectos/${a.proyecto_id}/actividades/${a.id}`,
    })),
    ...tareas
      .filter((t) => t.responsable_id === usuarioId)
      .map((t) => ({
        tipo: "tarea",
        id: t.id,
        titulo: t.titulo,
        estado: t.estado,
        prioridad: t.prioridad,
        fecha_inicio: t.fecha_inicio,
        fecha_fin: t.fecha_fin,
        origen: t.proyecto_codigo ? `Tarea · ${t.proyecto_codigo}` : "Tarea",
        enlace: `#/tareas/${t.id}`,
      })),
  ];
  const vencidas = pendientes.filter((p) => p.fecha_fin && soloFecha(p.fecha_fin) < hoyFecha);
  const paraHoy = pendientes.filter((p) => !vencidas.includes(p) && esParaHoy(p, hoyFecha));
  const urgentes = pendientes.filter((p) => p.prioridad === "urgente" || p.prioridad === "alta");

  // Por aprobar: solo lo que el cargo de la persona puede decidir.
  const aprobaciones = [];
  if (tienePermiso(usuario, "aprobar_oc") && porAprobar.oc_por_aprobar) {
    aprobaciones.push({
      texto: "Órdenes de compra por aprobar",
      n: porAprobar.oc_por_aprobar,
      enlace: "#/compras",
    });
  }
  if (tienePermiso(usuario, "pagar_oc") && porAprobar.oc_por_pagar) {
    aprobaciones.push({
      texto: "Órdenes de compra por pagar",
      n: porAprobar.oc_por_pagar,
      enlace: "#/ordenes-compra",
    });
  }
  if (tienePermiso(usuario, "aprobar_cotizacion") && porAprobar.cotizaciones_en_aprobacion) {
    aprobaciones.push({
      texto: "Cotizaciones en aprobación",
      n: porAprobar.cotizaciones_en_aprobacion,
      enlace: "#/comercial",
    });
  }
  if (tienePermiso(usuario, "aprobar_diseno") && porAprobar.cambios_diseno_pendientes) {
    aprobaciones.push({
      texto: "Cambios de diseño por decidir",
      n: porAprobar.cambios_diseno_pendientes,
      enlace: "#/expedientes-diseno",
    });
  }

  // Semana en curso: finalizadas por día y pendientes que vencen ese día.
  const lunes = new Date(hoyFecha.getTime() - ((hoyFecha.getDay() + 6) % 7) * UN_DIA_MS);
  const finalizadasPorDia = new Map(
    finalizadas.map((f) => [aTexto(soloFecha(f.dia)), Number(f.n)])
  );
  const semana = Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(lunes.getTime() + i * UN_DIA_MS);
    const texto = aTexto(dia);
    return {
      dia: texto,
      finalizadas: finalizadasPorDia.get(texto) || 0,
      pendientes: pendientes.filter((p) => p.fecha_fin && aTexto(soloFecha(p.fecha_fin)) === texto)
        .length,
    };
  });

  const conFecha = Number(cumplimiento.con_fecha);
  return {
    usuario: { nombre: usuario ? usuario.nombre : "", cargo: usuario ? usuario.cargo : null },
    kpis: {
      para_hoy: paraHoy.length,
      vencidas: vencidas.length,
      urgentes: urgentes.length,
      por_aprobar: aprobaciones.reduce((s, a) => s + a.n, 0),
      finalizadas_mes: Number(cumplimiento.finalizadas),
      cumplimiento_mes: conFecha
        ? Math.round((Number(cumplimiento.a_tiempo) * 100) / conFecha)
        : null,
      a_tiempo_mes: Number(cumplimiento.a_tiempo),
      con_fecha_mes: conFecha,
    },
    para_hoy: [...vencidas, ...paraHoy].slice(0, 8),
    aprobaciones,
    proyectos,
    avisos,
    semana,
  };
}

module.exports = { obtenerTableroGeneral };
