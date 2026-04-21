// Catálogo curado de trucos y conjuros de nivel 1 del PHB 5E (cap. 11).
// Cubre las seis clases lanzadoras principales (bardo, clérigo, druida, hechicero, brujo, mago)
// más paladín y explorador donde aplique. Los nombres siguen la nomenclatura en español del PHB;
// los ids usan kebab-case sin acentos para ser estables.

export type SpellSchool =
  | "abjuracion"
  | "adivinacion"
  | "conjuracion"
  | "encantamiento"
  | "evocacion"
  | "ilusion"
  | "nigromancia"
  | "transmutacion";

export type SpellClassId =
  | "bardo"
  | "clerigo"
  | "druida"
  | "hechicero"
  | "brujo"
  | "mago"
  | "paladin"
  | "explorador";

export type Spell = {
  id: string;
  name: string;
  level: number; // 0 = truco
  school: SpellSchool;
  classes: SpellClassId[];
  ritual?: boolean;
  concentration?: boolean;
  description: string;
};

export const SPELLS: Spell[] = [
  // ---------- Trucos (nivel 0) ----------
  { id: "chorro-acido", name: "Chorro de ácido", level: 0, school: "conjuracion", classes: ["hechicero", "mago"], description: "Lanza una burbuja ácida; hasta dos criaturas a 18m de distancia realizan salvación de DES o reciben 1d6 de daño ácido." },
  { id: "toque-escalofriante", name: "Toque escalofriante", level: 0, school: "nigromancia", classes: ["hechicero", "brujo", "mago"], description: "Ataque de conjuro a distancia; 1d8 de daño necrótico y el objetivo no puede recuperar PG hasta el inicio de tu próximo turno." },
  { id: "luces-danzantes", name: "Luces danzantes", level: 0, school: "evocacion", classes: ["bardo", "hechicero", "mago"], concentration: true, description: "Creas hasta 4 luces del tamaño de una antorcha que puedes mover hasta 18m como acción adicional." },
  { id: "truco-druidico", name: "Truco druídico", level: 0, school: "transmutacion", classes: ["druida"], description: "Efectos naturales menores: predices el clima, enciendes/apagas fuegos pequeños o haces florecer una planta." },
  { id: "andanada-eldritch", name: "Andanada eldritch", level: 0, school: "evocacion", classes: ["brujo"], description: "Rayo de energía crepitante. Ataque de conjuro a distancia; 1d10 de daño de fuerza. Añade un rayo adicional a nivel 5, 11 y 17." },
  { id: "rayo-fuego", name: "Rayo de fuego", level: 0, school: "evocacion", classes: ["hechicero", "mago"], description: "Ataque de conjuro a distancia a 36m; 1d10 de daño de fuego. Los objetos inflamables no sujetos se prenden." },
  { id: "orientacion", name: "Orientación", level: 0, school: "adivinacion", classes: ["clerigo", "druida"], concentration: true, description: "Por hasta 1 minuto, una criatura tocada puede añadir 1d4 a una prueba de habilidad a su elección." },
  { id: "luz", name: "Luz", level: 0, school: "evocacion", classes: ["bardo", "clerigo", "hechicero", "mago"], description: "Un objeto tocado emite luz brillante en un radio de 6m y luz tenue 6m más allá durante 1 hora." },
  { id: "mano-mago", name: "Mano de mago", level: 0, school: "conjuracion", classes: ["bardo", "hechicero", "brujo", "mago"], description: "Invocas una mano espectral que puede manipular objetos ligeros a 9m de ti durante 1 minuto." },
  { id: "reparar", name: "Reparar", level: 0, school: "transmutacion", classes: ["bardo", "clerigo", "druida", "hechicero", "mago"], description: "Reparas una sola rotura o desgarro en un objeto tocado." },
  { id: "mensaje", name: "Mensaje", level: 0, school: "transmutacion", classes: ["bardo", "hechicero", "mago"], description: "Envías un mensaje corto a una criatura a 36m. Solo ella lo oye y puede responder del mismo modo." },
  { id: "ilusion-menor", name: "Ilusión menor", level: 0, school: "ilusion", classes: ["bardo", "hechicero", "brujo", "mago"], description: "Creas un sonido o imagen estática (≤ 1,5m) a 9m durante 1 minuto. Salvación INT para detectar." },
  { id: "aerosol-venenoso", name: "Aerosol venenoso", level: 0, school: "conjuracion", classes: ["druida", "hechicero", "brujo", "mago"], description: "Una criatura a 3m realiza salvación CON o recibe 1d12 daño de veneno." },
  { id: "prestidigitacion", name: "Prestidigitación", level: 0, school: "transmutacion", classes: ["bardo", "hechicero", "brujo", "mago"], description: "Efectos mágicos menores (señal sensorial, limpieza, iluminación, alteración leve). Hasta tres efectos activos." },
  { id: "llama-manifestada", name: "Llama manifestada", level: 0, school: "conjuracion", classes: ["druida"], description: "Una llama titila en tu mano (6m de luz). Puedes lanzarla como ataque de conjuro a 9m; 1d8 daño de fuego." },
  { id: "rayo-escarcha", name: "Rayo de escarcha", level: 0, school: "evocacion", classes: ["hechicero", "mago"], description: "Ataque de conjuro a distancia a 18m; 1d8 daño frío y la velocidad del objetivo baja 3m hasta tu próximo turno." },
  { id: "resistencia", name: "Resistencia", level: 0, school: "abjuracion", classes: ["clerigo", "druida"], concentration: true, description: "Por 1 minuto, una criatura tocada puede añadir 1d4 a una salvación a su elección." },
  { id: "llama-sagrada", name: "Llama sagrada", level: 0, school: "evocacion", classes: ["clerigo"], description: "Una criatura a 18m realiza salvación DES o recibe 1d8 daño radiante. Ignora cobertura no total." },
  { id: "shillelagh", name: "Shillelagh", level: 0, school: "transmutacion", classes: ["druida"], description: "Un garrote o bastón se vuelve mágico por 1 minuto; usa SAB para atacar y hace 1d8 contundente." },
  { id: "contacto-electrificante", name: "Contacto electrificante", level: 0, school: "evocacion", classes: ["hechicero", "mago"], description: "Ataque de conjuro cuerpo a cuerpo con ventaja si el objetivo lleva metal; 1d8 rayo y no puede usar reacciones." },
  { id: "evitar-muerte", name: "Evitar la muerte", level: 0, school: "nigromancia", classes: ["clerigo"], description: "Estabilizas a una criatura tocada con 0 PG." },
  { id: "taumaturgia", name: "Taumaturgia", level: 0, school: "transmutacion", classes: ["clerigo"], description: "Manifiestas un portento menor: alteras tu voz, haces vibrar el suelo, abres puertas no cerradas con llave, etc." },
  { id: "golpe-certero", name: "Golpe certero", level: 0, school: "adivinacion", classes: ["bardo", "hechicero", "brujo", "mago"], concentration: true, description: "Conoces una debilidad del objetivo: tu próximo ataque contra él tiene ventaja antes del final de tu próximo turno." },
  { id: "burla-cruel", name: "Burla cruel", level: 0, school: "encantamiento", classes: ["bardo"], description: "Una criatura a 18m realiza salvación SAB o recibe 1d4 daño psíquico y desventaja en su próximo tirada de ataque." },

  // ---------- Nivel 1 ----------
  { id: "alarma", name: "Alarma", level: 1, school: "abjuracion", classes: ["mago", "explorador"], ritual: true, description: "Designas un área (cubo de 6m) a 9m; te alerta cuando una criatura Pequeña o mayor la toca. Dura 8 horas." },
  { id: "amistad-animales", name: "Amistad con los animales", level: 1, school: "encantamiento", classes: ["bardo", "druida", "explorador"], description: "Una bestia con INT ≤ 3 realiza salvación SAB o queda hechizada por 24 horas." },
  { id: "perdicion", name: "Perdición", level: 1, school: "encantamiento", classes: ["bardo", "clerigo"], concentration: true, description: "Hasta 3 criaturas a 9m; salvación CAR o restan 1d4 a tiradas de ataque y salvaciones durante 1 minuto." },
  { id: "bendecir", name: "Bendecir", level: 1, school: "encantamiento", classes: ["clerigo", "paladin"], concentration: true, description: "Hasta 3 criaturas a 9m añaden 1d4 a tiradas de ataque y salvaciones durante 1 minuto." },
  { id: "manos-abrasadoras", name: "Manos abrasadoras", level: 1, school: "evocacion", classes: ["hechicero", "mago"], description: "Cono de 4,5m; salvación DES o 3d6 daño de fuego (la mitad si éxito). Prende objetos inflamables." },
  { id: "hechizar-persona", name: "Hechizar persona", level: 1, school: "encantamiento", classes: ["bardo", "druida", "hechicero", "brujo", "mago"], description: "Un humanoide a 9m realiza salvación SAB o queda hechizado durante 1 hora." },
  { id: "rafaga-color", name: "Ráfaga de color", level: 1, school: "ilusion", classes: ["hechicero", "mago"], description: "Cono de 4,5m; ciega hasta 6d10 PG de criaturas (menores a mayores) hasta el inicio de tu próximo turno." },
  { id: "orden", name: "Orden", level: 1, school: "encantamiento", classes: ["clerigo", "paladin"], description: "Una criatura a 18m realiza salvación SAB o cumple una orden de una palabra en su próximo turno." },
  { id: "comprender-idiomas", name: "Comprender idiomas", level: 1, school: "adivinacion", classes: ["bardo", "hechicero", "brujo", "mago"], ritual: true, description: "Entiendes el significado literal de cualquier idioma hablado o escrito durante 1 hora." },
  { id: "curar-heridas", name: "Curar heridas", level: 1, school: "evocacion", classes: ["bardo", "clerigo", "druida", "paladin", "explorador"], description: "Una criatura tocada recupera 1d8 + tu mod de atributo de lanzamiento PG." },
  { id: "detectar-bien-mal", name: "Detectar el bien y el mal", level: 1, school: "adivinacion", classes: ["clerigo", "paladin"], concentration: true, description: "Durante 10 min percibes aberraciones, celestiales, elementales, hadas, feúchos y muertos vivientes a 9m." },
  { id: "detectar-magia", name: "Detectar magia", level: 1, school: "adivinacion", classes: ["bardo", "clerigo", "druida", "paladin", "explorador", "hechicero", "mago"], ritual: true, concentration: true, description: "Detectas magia a 9m durante 10 min y puedes identificar su escuela al concentrarte sobre ella." },
  { id: "detectar-veneno-enfermedad", name: "Detectar veneno y enfermedad", level: 1, school: "adivinacion", classes: ["clerigo", "druida", "paladin", "explorador"], ritual: true, concentration: true, description: "Hueles venenos y enfermedades a 9m durante 10 minutos." },
  { id: "disfrazarse", name: "Disfrazarse", level: 1, school: "ilusion", classes: ["bardo", "hechicero", "mago"], description: "Cambias tu apariencia (altura ±30cm) durante 1 hora. Las pruebas físicas desvelan la ilusión." },
  { id: "murmullos-disonantes", name: "Murmullos disonantes", level: 1, school: "encantamiento", classes: ["bardo"], description: "Una criatura a 18m; salvación SAB o 3d6 psíquico y usa su reacción para alejarse. La mitad si éxito." },
  { id: "enmaranar", name: "Enmarañar", level: 1, school: "conjuracion", classes: ["druida"], concentration: true, description: "Cuadrado de 6m a 27m se llena de plantas; salvación FUE o apresado por 1 minuto." },
  { id: "retirada-expeditiva", name: "Retirada expeditiva", level: 1, school: "transmutacion", classes: ["hechicero", "brujo", "mago"], concentration: true, description: "Como acción adicional puedes usar la acción de Correr en cada turno durante 10 minutos." },
  { id: "fuego-feerico", name: "Fuego feérico", level: 1, school: "evocacion", classes: ["bardo", "druida"], concentration: true, description: "Cubo de 6m a 18m; salvación DES o los objetos/criaturas se iluminan y los ataques contra ellos tienen ventaja." },
  { id: "falsa-vida", name: "Falsa vida", level: 1, school: "nigromancia", classes: ["hechicero", "mago"], description: "Ganas 1d4+4 PG temporales por 1 hora." },
  { id: "caida-pluma", name: "Caída de pluma", level: 1, school: "transmutacion", classes: ["bardo", "hechicero", "mago"], description: "Reacción: hasta 5 criaturas a 18m caen a 18m/round y no reciben daño por caída durante 1 minuto." },
  { id: "encontrar-familiar", name: "Encontrar familiar", level: 1, school: "conjuracion", classes: ["mago"], ritual: true, description: "Invocas un espíritu en forma de bestia diminuta que actúa como familiar (lectura de sentidos, entregar conjuros)." },
  { id: "nube-niebla", name: "Nube de niebla", level: 1, school: "conjuracion", classes: ["druida", "explorador", "hechicero", "mago"], concentration: true, description: "Esfera de niebla de 6m a 36m. Oculta cualquier cosa dentro durante 1 hora." },
  { id: "baya-magica", name: "Baya mágica", level: 1, school: "transmutacion", classes: ["druida", "explorador"], description: "Creas 10 bayas. Cada una restaura 1 PG y cuenta como comida y agua del día." },
  { id: "grasa", name: "Grasa", level: 1, school: "conjuracion", classes: ["mago"], description: "Cuadrado de 3m a 18m; terreno difícil. Quien esté/termine allí: salvación DES o cae prono." },
  { id: "proyectil-guiado", name: "Proyectil guiado", level: 1, school: "evocacion", classes: ["clerigo"], description: "Ataque de conjuro a distancia a 36m; 4d6 daño radiante y tu próximo ataque contra el objetivo tiene ventaja." },
  { id: "palabra-curacion", name: "Palabra de curación", level: 1, school: "evocacion", classes: ["bardo", "clerigo", "druida"], description: "Acción adicional: una criatura a 18m recupera 1d4 + tu mod de atributo PG." },
  { id: "reprimenda-infernal", name: "Reprimenda infernal", level: 1, school: "evocacion", classes: ["brujo"], description: "Reacción tras recibir daño: el atacante (a 18m) realiza salvación DES o recibe 2d10 daño de fuego." },
  { id: "heroismo", name: "Heroísmo", level: 1, school: "encantamiento", classes: ["bardo", "paladin"], concentration: true, description: "Una criatura tocada gana inmunidad al miedo y PG temporales iguales a tu mod de atributo al inicio de cada turno." },
  { id: "maleficio", name: "Maleficio", level: 1, school: "encantamiento", classes: ["brujo"], concentration: true, description: "Una criatura a 27m recibe 1d6 daño necrótico extra de tus ataques, y desventaja en una habilidad elegida." },
  { id: "marca-cazador", name: "Marca del cazador", level: 1, school: "adivinacion", classes: ["explorador"], concentration: true, description: "Marcas una criatura a 27m; tus ataques contra ella hacen 1d6 extra y tienes ventaja al rastrearla." },
  { id: "identificar", name: "Identificar", level: 1, school: "adivinacion", classes: ["bardo", "mago"], ritual: true, description: "Revelas las propiedades mágicas de un objeto tocado tras 10 minutos de concentración." },
  { id: "causar-heridas", name: "Causar heridas", level: 1, school: "nigromancia", classes: ["clerigo"], description: "Ataque de conjuro cuerpo a cuerpo; 3d10 daño necrótico." },
  { id: "salto", name: "Salto", level: 1, school: "transmutacion", classes: ["druida", "explorador", "hechicero", "mago"], description: "Una criatura tocada triplica su distancia de salto durante 1 minuto." },
  { id: "zancada-prolongada", name: "Zancada prolongada", level: 1, school: "transmutacion", classes: ["bardo", "druida", "explorador", "mago"], description: "Una criatura tocada aumenta su velocidad en 3m durante 1 hora." },
  { id: "armadura-mago", name: "Armadura de mago", level: 1, school: "abjuracion", classes: ["hechicero", "mago"], description: "Un objetivo dispuesto sin armadura gana CA = 13 + mod DES durante 8 horas." },
  { id: "proyectil-magico", name: "Proyectil mágico", level: 1, school: "evocacion", classes: ["hechicero", "mago"], description: "Disparas 3 dardos de energía a criaturas a 36m; cada uno acierta automáticamente y hace 1d4+1 daño de fuerza." },
  { id: "proteccion-bien-mal", name: "Protección contra el bien y el mal", level: 1, school: "abjuracion", classes: ["clerigo", "paladin", "brujo", "mago"], concentration: true, description: "Una criatura tocada: los tipos de enemigo listados tienen desventaja al atacarla y ella contra ser hechizada/asustada/poseída." },
  { id: "purificar-comida-bebida", name: "Purificar comida y bebida", level: 1, school: "transmutacion", classes: ["clerigo", "druida", "paladin"], ritual: true, description: "Esfera de 1,5m a 3m; la comida y bebida no mágicas quedan libres de veneno y enfermedad." },
  { id: "santuario", name: "Santuario", level: 1, school: "abjuracion", classes: ["clerigo"], description: "Acción adicional: una criatura tocada queda protegida; los atacantes salvan SAB o cambian de objetivo durante 1 minuto." },
  { id: "escudo", name: "Escudo", level: 1, school: "abjuracion", classes: ["hechicero", "mago"], description: "Reacción: +5 a tu CA hasta el inicio de tu próximo turno, incluido contra el ataque desencadenante." },
  { id: "escudo-fe", name: "Escudo de la fe", level: 1, school: "abjuracion", classes: ["clerigo", "paladin"], concentration: true, description: "Una criatura a 18m gana +2 a la CA por 10 minutos." },
  { id: "imagen-silenciosa", name: "Imagen silenciosa", level: 1, school: "ilusion", classes: ["bardo", "hechicero", "mago"], concentration: true, description: "Creas una imagen visual dentro de un cubo de 4,5m a 18m durante 10 minutos. Salvación INT para detectar." },
  { id: "dormir", name: "Dormir", level: 1, school: "encantamiento", classes: ["bardo", "hechicero", "mago"], description: "5d8 PG de criaturas en esfera de 6m (9m de rango) quedan inconscientes (menor primero). No afecta no-muertos ni inmunes." },
  { id: "hablar-animales", name: "Hablar con los animales", level: 1, school: "adivinacion", classes: ["bardo", "druida", "explorador"], ritual: true, description: "Puedes comprender y comunicarte con bestias durante 10 minutos." },
  { id: "estruendo", name: "Estruendo", level: 1, school: "evocacion", classes: ["bardo", "druida", "hechicero", "mago"], description: "Cubo de 4,5m; salvación CON o 2d8 daño de trueno y empuje 3m. Mitad si éxito." },
  { id: "sirviente-invisible", name: "Sirviente invisible", level: 1, school: "conjuracion", classes: ["bardo", "brujo", "mago"], ritual: true, description: "Invocas una fuerza sin forma que sigue órdenes sencillas durante 1 hora." },
  { id: "rayo-embrujado", name: "Rayo embrujado", level: 1, school: "evocacion", classes: ["hechicero", "brujo", "mago"], concentration: true, description: "Ataque de conjuro a 9m; 1d12 daño de rayo y como acción automática cada turno repite el daño durante 1 minuto." },
  { id: "risa-horrible", name: "Risa horrible", level: 1, school: "encantamiento", classes: ["bardo", "mago"], concentration: true, description: "Una criatura a 9m; salvación SAB o cae prona y queda incapacitada riendo durante 1 minuto." },
];

export function spellsForClassAtLevel(classId: SpellClassId, level: number): Spell[] {
  return SPELLS.filter((s) => s.classes.includes(classId) && s.level === level);
}

export function findSpellByName(name: string): Spell | undefined {
  const n = name.trim().toLowerCase();
  return SPELLS.find((s) => s.name.toLowerCase() === n || s.id === n);
}
