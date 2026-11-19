// Estados y prioridades comunes a las actividades de proyecto y a las tareas.
// "completada" se muestra como "Finalizado" (el valor guardado no cambia).
const ESTADOS_TRABAJO = {
  PENDIENTE: "pendiente",
  EN_CURSO: "en_curso",
  COMPLETADA: "completada",
};

// "normal" no se muestra; "alta" va en amarillo y "urgente" en rojo.
const PRIORIDADES = {
  NORMAL: "normal",
  ALTA: "alta",
  URGENTE: "urgente",
};

const TEXTO_PRIORIDAD = { normal: "Normal", alta: "Alta", urgente: "Urgente" };

module.exports = { ESTADOS_TRABAJO, PRIORIDADES, TEXTO_PRIORIDAD };
