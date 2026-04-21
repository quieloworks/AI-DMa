// Catálogo de dotes del PHB cap. 6 (Feats, p. 165-170).
// Nombres en español siguiendo la nomenclatura oficial; IDs kebab-case sin acentos.
//
// `abilityBonus` describe un ASI parcial (p.ej. Resiliente = +1 a un atributo a elección y
// competencia en esa salvación). Cuando `from.length === 1` el atributo está fijado.
// `grants` es un bullet-list breve de lo que otorga el dote; se guarda sólo el id y se
// resuelve el texto en UI/review.

import type { Ability } from "./character";

export type FeatAbilityOption = {
  count: number;
  value: number;
  from: Ability[];
};

export type Feat = {
  id: string;
  name: string;
  prerequisite?: string;
  abilityBonus?: FeatAbilityOption;
  summary: string;
  grants: string[];
};

// Orden alfabético en español para presentación consistente.
export const FEATS: Feat[] = [
  {
    id: "actor",
    name: "Actor",
    abilityBonus: { count: 1, value: 1, from: ["car"] },
    summary: "Talento para la imitación y el engaño escénico.",
    grants: [
      "+1 Carisma",
      "Ventaja en Engaño e Interpretación al pasar por otra persona",
      "Imitas voz/acento de alguien tras escucharlo al menos 1 minuto",
    ],
  },
  {
    id: "alerta",
    name: "Alerta",
    summary: "Reaccionas antes que nadie y nunca te pillan desprevenido.",
    grants: [
      "+5 a la iniciativa",
      "No puedes quedar sorprendido mientras estés consciente",
      "Criaturas ocultas no tienen ventaja al atacarte",
    ],
  },
  {
    id: "armadura-ligera",
    name: "Armadura ligera",
    abilityBonus: { count: 1, value: 1, from: ["fue", "des"] },
    summary: "Entrenamiento básico con armaduras ligeras.",
    grants: ["+1 Fuerza o Destreza a elección", "Competencia con armadura ligera"],
  },
  {
    id: "armadura-media",
    name: "Armadura media",
    prerequisite: "Competencia con armadura ligera",
    abilityBonus: { count: 1, value: 1, from: ["fue", "des"] },
    summary: "Manejas armaduras medias y escudos.",
    grants: ["+1 Fuerza o Destreza a elección", "Competencia con armadura media y escudos"],
  },
  {
    id: "armadura-pesada",
    name: "Armadura pesada",
    prerequisite: "Competencia con armadura media",
    abilityBonus: { count: 1, value: 1, from: ["fue"] },
    summary: "Soportas cualquier armadura del catálogo.",
    grants: ["+1 Fuerza", "Competencia con armadura pesada"],
  },
  {
    id: "asesino-magos",
    name: "Asesino de magos",
    summary: "Experto en interrumpir lanzadores de conjuros.",
    grants: [
      "Ventaja en salvaciones contra conjuros lanzados a 1,5m de ti",
      "Reacción: ataque cuerpo a cuerpo cuando una criatura a 1,5m lance un conjuro",
      "Quienes reciban tu daño tienen desventaja para mantener concentración",
    ],
  },
  {
    id: "atacante-salvaje",
    name: "Atacante salvaje",
    summary: "Golpes feroces e impredecibles.",
    grants: ["Una vez por turno, repite la tirada de daño de un ataque cuerpo a cuerpo y elige el resultado"],
  },
  {
    id: "atleta",
    name: "Atleta",
    abilityBonus: { count: 1, value: 1, from: ["fue", "des"] },
    summary: "Destreza física sobresaliente.",
    grants: [
      "+1 Fuerza o Destreza",
      "Levantarse desde prono gasta sólo 1,5m de movimiento",
      "Trepar no reduce tu velocidad a la mitad",
      "Saltos sin carrerilla con sólo 1,5m de aproximación",
    ],
  },
  {
    id: "celador",
    name: "Celador",
    summary: "Controlas la zona que te rodea con amenaza constante.",
    grants: [
      "Reducir a 0 la velocidad de una criatura con un ataque de oportunidad",
      "Atacar con ventaja en ataques de oportunidad incluso si el objetivo Dispara",
      "Reacción de ataque cuerpo a cuerpo cuando una criatura a 1,5m ataca a otra",
    ],
  },
  {
    id: "cargador",
    name: "Cargador",
    summary: "Convierte una carrera en un impacto devastador.",
    grants: [
      "Tras usar Correr, bono de acción para ataque cuerpo a cuerpo +5 daño",
      "Alternativa: empuja al objetivo 3m en lugar del daño extra",
    ],
  },
  {
    id: "curandero",
    name: "Curandero",
    summary: "Maestro del equipo de curación.",
    grants: [
      "Estabilizar con equipo de sanador restaura 1 PG",
      "Acción + carga de equipo: 1d6+4 + nivel PG al objetivo (uno por descanso corto)",
    ],
  },
  {
    id: "delver",
    name: "Delver",
    summary: "Especialista en mazmorras.",
    grants: [
      "Ventaja en Percepción/Investigación para puertas secretas",
      "Ventaja en salvaciones contra trampas y resistencia al daño de trampas",
      "Buscas a ritmo normal sin penalizadores",
    ],
  },
  {
    id: "diestro-escudos",
    name: "Diestro con escudos",
    summary: "Convierte tu escudo en arma y muro.",
    grants: [
      "Acción adicional: empujar 1,5m con el escudo (salvación FUE)",
      "Bonificador +2 del escudo se aplica a salvaciones DES contra efectos que te afectan a ti",
      "Si un conjuro te obliga a salvación DES y la superas, ningún daño en lugar de la mitad",
    ],
  },
  {
    id: "disciplina-elemental",
    name: "Discípulo elemental",
    prerequisite: "Capaz de lanzar al menos un conjuro",
    summary: "Especialízate en un tipo de daño elemental.",
    grants: [
      "Tus conjuros ignoran la resistencia al tipo de daño elegido (ácido/frío/fuego/rayo/trueno)",
      "Trata los 1 de daño como 2 en los dados de ese tipo",
    ],
  },
  {
    id: "duelista-defensivo",
    name: "Duelista defensivo",
    prerequisite: "Destreza 13",
    summary: "Reaccionas para parar con tu arma ligera.",
    grants: ["Al ser golpeado cuerpo a cuerpo con un arma con sutileza, reacción: +bono competencia a CA contra ese ataque"],
  },
  {
    id: "duradero",
    name: "Duradero",
    abilityBonus: { count: 1, value: 1, from: ["con"] },
    summary: "Te recuperas mejor tras un descanso.",
    grants: ["+1 Constitución", "Al recuperar PG con dados de golpe, el mínimo es 2× tu mod CON"],
  },
  {
    id: "experto-ballesta",
    name: "Experto en ballestas",
    summary: "Dominas las ballestas en combate cercano.",
    grants: [
      "Ignoras la propiedad recargar en ballestas con las que eres competente",
      "No tienes desventaja al disparar a distancia estando a 1,5m de un enemigo",
      "Cuando atacas con un arma de una mano, bono de acción para disparar ballesta de mano",
    ],
  },
  {
    id: "francotirador",
    name: "Francotirador",
    summary: "Tus disparos son letales a cualquier distancia.",
    grants: [
      "No sufres desventaja por el rango largo de armas a distancia",
      "Los ataques a distancia ignoran cobertura ligera y media",
      "Antes de atacar con arma a distancia con competencia, −5 al ataque para +10 al daño",
    ],
  },
  {
    id: "gran-arma-maestro",
    name: "Maestro de armas a dos manos",
    summary: "Las armas pesadas explotan en tus manos.",
    grants: [
      "Crítico o bajar a 0 con un arma cuerpo a cuerpo: bono de acción para otro ataque cuerpo a cuerpo",
      "Con un arma pesada cuerpo a cuerpo con competencia, −5 al ataque para +10 daño",
    ],
  },
  {
    id: "grapplero",
    name: "Luchador cuerpo a cuerpo",
    prerequisite: "Fuerza 13",
    summary: "Especializado en agarres y presas.",
    grants: [
      "Ventaja en ataques contra criaturas agarradas por ti",
      "Como acción, intenta inmovilizar a una criatura agarrada (ambas quedan aprisionadas)",
    ],
  },
  {
    id: "iniciado-magia",
    name: "Iniciado en magia",
    summary: "Aprendes magia de otra clase.",
    grants: [
      "Elige clase (bardo/clérigo/druida/hechicero/brujo/mago): 2 trucos + 1 conjuro nv 1",
      "El conjuro de nivel 1 se lanza una vez por descanso largo sin gastar espacio",
    ],
  },
  {
    id: "idiomas",
    name: "Lingüista",
    abilityBonus: { count: 1, value: 1, from: ["int"] },
    summary: "Políglota natural.",
    grants: [
      "+1 Inteligencia",
      "Aprendes 3 idiomas a elección",
      "Puedes crear cifrados escritos que sólo descifran quienes enseñes",
    ],
  },
  {
    id: "jinete",
    name: "Combatiente montado",
    summary: "Excelente en combate a lomos de tu montura.",
    grants: [
      "Ventaja en ataques cuerpo a cuerpo contra criaturas más pequeñas que tu montura",
      "Puedes redirigir a ti un ataque dirigido a tu montura",
      "Tu montura superando salvaciones DES no recibe daño y la mitad si falla",
    ],
  },
  {
    id: "lider-inspirador",
    name: "Líder inspirador",
    prerequisite: "Carisma 13",
    summary: "Tus palabras galvanizan al grupo.",
    grants: ["Tras un discurso de 10 min, hasta 6 criaturas a 9m reciben nivel + mod CAR PG temporales"],
  },
  {
    id: "maestro-armadura-media",
    name: "Maestro de armadura media",
    prerequisite: "Competencia con armadura media",
    summary: "Optimiza el uso de la armadura media.",
    grants: [
      "Llevar armadura media no te da desventaja en Sigilo",
      "Puedes añadir +3 de mod DES (en lugar de +2) si la tienes 16+",
    ],
  },
  {
    id: "maestro-armadura-pesada",
    name: "Maestro de armadura pesada",
    prerequisite: "Competencia con armadura pesada",
    abilityBonus: { count: 1, value: 1, from: ["fue"] },
    summary: "Armadura pesada como segunda piel.",
    grants: [
      "+1 Fuerza",
      "Mientras lleves armadura pesada, reduces en 3 el daño contundente/perforante/cortante no mágico",
    ],
  },
  {
    id: "maestro-armas",
    name: "Maestro de armas",
    abilityBonus: { count: 1, value: 1, from: ["fue", "des"] },
    summary: "Amplía tu arsenal marcial.",
    grants: ["+1 Fuerza o Destreza", "Competencia con 4 armas a elección"],
  },
  {
    id: "mente-aguda",
    name: "Mente aguda",
    abilityBonus: { count: 1, value: 1, from: ["int"] },
    summary: "Memoria y orientación sobrehumanas.",
    grants: [
      "+1 Inteligencia",
      "Siempre conoces la dirección norte y las horas hasta el próximo amanecer",
      "Recuerdas con precisión cualquier cosa vista u oída en el último mes",
    ],
  },
  {
    id: "mobil",
    name: "Móvil",
    summary: "Ligero como el viento.",
    grants: [
      "+3m de velocidad",
      "Correr te deja cruzar terreno difícil sin penalización",
      "Tras atacar cuerpo a cuerpo, ese objetivo no puede hacerte ataque de oportunidad ese turno",
    ],
  },
  {
    id: "observador",
    name: "Observador",
    abilityBonus: { count: 1, value: 1, from: ["int", "sab"] },
    summary: "Atento a cada detalle.",
    grants: [
      "+1 Inteligencia o Sabiduría",
      "+5 a Percepción pasiva e Investigación pasiva",
      "Puedes leer los labios de quien hable un idioma que conozcas",
    ],
  },
  {
    id: "polearmas",
    name: "Maestro de armas de asta",
    summary: "Aprovecha cada centímetro de alcance.",
    grants: [
      "Al atacar con alabarda/hacha de batalla/bastón largo, bono de acción 1d4 contundente con el otro extremo",
      "Provocas ataque de oportunidad cuando una criatura entra en tu alcance",
    ],
  },
  {
    id: "resiliente",
    name: "Resiliente",
    abilityBonus: { count: 1, value: 1, from: ["fue", "des", "con", "int", "sab", "car"] },
    summary: "Dominas un tipo de salvación.",
    grants: [
      "+1 al atributo elegido",
      "Ganas competencia en salvaciones de ese atributo",
    ],
  },
  {
    id: "ritualista",
    name: "Ritualista",
    prerequisite: "Inteligencia o Sabiduría 13",
    summary: "Depositario de conocimiento ritual.",
    grants: [
      "Libro ritual con 2 conjuros rituales de nivel 1 de una clase a elección",
      "Puedes copiar nuevos conjuros rituales a tu libro",
    ],
  },
  {
    id: "sagaz",
    name: "Suertudo",
    summary: "La fortuna te sonríe tres veces al día.",
    grants: [
      "3 puntos de suerte por descanso largo",
      "Gastar 1 punto para tirar un d20 extra en un ataque, prueba o salvación y quedarte con la mejor",
      "Gastar 1 punto para obligar a un atacante a repetir su tirada contra ti",
    ],
  },
  {
    id: "soldado-montado",
    name: "Adepto marcial",
    summary: "Técnicas marciales al estilo del Maestro de Batalla.",
    grants: [
      "Aprendes 2 maniobras del arquetipo Maestro de batalla",
      "1 dado de superioridad (d6)",
    ],
  },
  {
    id: "tabernario",
    name: "Pendenciero",
    abilityBonus: { count: 1, value: 1, from: ["fue", "con"] },
    summary: "Cualquier cosa es arma en tus manos.",
    grants: [
      "+1 Fuerza o Constitución",
      "Competencia con armas improvisadas",
      "Tu puño inflige 1d4 contundente",
      "Al acertar con puño o improvisada, intento de agarre como bono de acción",
    ],
  },
  {
    id: "tirador-magico",
    name: "Francotirador mágico",
    prerequisite: "Capaz de lanzar al menos un conjuro",
    summary: "Tus conjuros a distancia son precisos y largos.",
    grants: [
      "Duplicas el alcance de los conjuros con tirada de ataque",
      "Tus ataques de conjuro ignoran cobertura ligera y media",
      "Aprendes un truco adicional de una clase lanzadora",
    ],
  },
  {
    id: "tirador-preciso",
    name: "Acechador",
    prerequisite: "Destreza 13",
    summary: "Especialista en moverse sin ser visto.",
    grants: [
      "Puedes esconderte aunque sólo estés ligeramente oscurecido",
      "Fallar un ataque a distancia no revela tu posición",
      "No tienes desventaja en Percepción por luz tenue",
    ],
  },
  {
    id: "tough",
    name: "Tenaz",
    summary: "Más duro de matar.",
    grants: ["PG máximos +2 × nivel (también +2 cada vez que subes de nivel)"],
  },
  {
    id: "usa-dos-armas",
    name: "Maestro de dos armas",
    summary: "Combate a dos manos perfeccionado.",
    grants: [
      "+1 CA mientras empuñes un arma cuerpo a cuerpo en cada mano",
      "Puedes aplicar lucha a dos manos con armas no ligeras",
      "Puedes sacar/envainar dos armas cuando antes podrías una",
    ],
  },
  {
    id: "versatil",
    name: "Versátil",
    summary: "Amplías tu repertorio de habilidades.",
    grants: ["Competencia en 3 habilidades o herramientas a elección"],
  },
  {
    id: "war-caster",
    name: "Lanzador de guerra",
    prerequisite: "Capaz de lanzar al menos un conjuro",
    summary: "Lanzas conjuros incluso bajo fuego enemigo.",
    grants: [
      "Ventaja en salvaciones de concentración para mantener conjuros",
      "Puedes ejecutar componentes somáticos con manos ocupadas (armas o escudo)",
      "Un ataque de oportunidad puede ser un conjuro de objetivo único en lugar de un ataque",
    ],
  },
];

export function findFeat(id: string): Feat | undefined {
  return FEATS.find((f) => f.id === id);
}
