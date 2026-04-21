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

  // --- Ampliación PR F (§3.1): smites de paladín y conjuros de brujo/explorador poco cubiertos ---
  { id: "golpe-abrasador", name: "Golpe abrasador", level: 1, school: "evocacion", classes: ["paladin"], concentration: true, description: "Tu próximo ataque con arma durante 1 min inflige 1d6 fuego extra; el objetivo salva CON o queda ardiendo (1d6 al inicio de su turno)." },
  { id: "golpe-iracundo", name: "Golpe iracundo", level: 1, school: "evocacion", classes: ["paladin"], concentration: true, description: "Durante 1 min, tu próximo ataque que impacte inflige 1d6 psíquico extra; el objetivo salva SAB o queda asustado hasta el final del conjuro." },
  { id: "golpe-atronador", name: "Golpe atronador", level: 1, school: "evocacion", classes: ["paladin"], description: "Tu siguiente ataque con arma que impacte inflige 1d6 trueno extra y el objetivo salva FUE o es empujado 3m y cae prono." },
  { id: "duelo-forzado", name: "Duelo forzado", level: 1, school: "encantamiento", classes: ["paladin"], concentration: true, description: "Una criatura a 9m salva SAB o queda atraída a duelo contigo por 1 min (desventaja contra otros, no puede alejarse a más de 9m)." },
  { id: "golpe-ensarador", name: "Golpe ensarzador", level: 1, school: "conjuracion", classes: ["explorador"], concentration: true, description: "Tu siguiente ataque con arma invoca zarzas mágicas: 1d6 perforante extra y el objetivo salva FUE o queda apresado." },
  { id: "golpe-viento-ceferino", name: "Golpe del viento ceferino", level: 1, school: "transmutacion", classes: ["explorador"], concentration: true, description: "Tu siguiente ataque ocurre con ventaja; si impacta, 1d6 fuerza extra y puedes moverte 9m sin provocar ataques de oportunidad." },
  { id: "estrepito-trueno", name: "Estrépito del trueno", level: 1, school: "transmutacion", classes: ["explorador", "bardo", "druida", "hechicero", "brujo", "mago"], description: "Tu siguiente ataque con arma inflige 2d6 trueno extra (se oye a 90m) y el objetivo salva FUE o es empujado 3m." },
  { id: "brazos-hadar", name: "Brazos de Hadar", level: 1, school: "conjuracion", classes: ["brujo"], description: "Aura de 3m: cada criatura a 3m salva FUE o recibe 2d6 necrótico y queda sin reacciones; la mitad si salva." },
  { id: "armadura-agathys", name: "Armadura de Agathys", level: 1, school: "abjuracion", classes: ["brujo"], description: "Ganas 5 PG temporales durante 1 hora. Al atacarte cuerpo a cuerpo mientras conservas los PG temp, el atacante recibe 5 daño frío." },
  { id: "rayo-caos", name: "Rayo del caos", level: 1, school: "evocacion", classes: ["hechicero"], description: "Ataque de conjuro a 36m; 2d8 + 1d6 de daño aleatorio (ácido/frío/fuego/fuerza/rayo/veneno/psíquico/trueno); con duplicado el rayo salta a otro objetivo." },
  { id: "maldicion-sangrienta", name: "Maldición sangrienta", level: 1, school: "nigromancia", classes: ["brujo"], concentration: true, description: "Una criatura a 9m salva CON o es maldecida 1 min: cada vez que le hagas daño, recibe 1d8 necrótico extra." },

  // --- Ampliación handoff §2.1 (2026-04): conjuros RAW de nivel 1 que faltaban (PHB cap. 11). ---
  { id: "favor-divino", name: "Favor divino", level: 1, school: "evocacion", classes: ["paladin"], concentration: true, description: "Durante 1 min, tus ataques con arma que impacten infligen 1d4 de daño radiante extra." },
  { id: "rayo-enfermedad", name: "Rayo de enfermedad", level: 1, school: "nigromancia", classes: ["hechicero", "mago"], description: "Ataque de conjuro a distancia a 18m; 2d8 daño necrótico. Si el objetivo es humanoide, salva CON o queda envenenado hasta el final de tu próximo turno." },
  { id: "aluvion-espinas", name: "Aluvión de espinas", level: 1, school: "conjuracion", classes: ["explorador"], description: "Cuando impactas con un ataque a distancia, todas las criaturas a 1,5m del objetivo salvan DES o reciben 1d10 perforante (mitad si éxito). Reacción con arma a distancia." },
  { id: "orbe-cromatico", name: "Orbe cromático", level: 1, school: "evocacion", classes: ["hechicero", "mago"], description: "Ataque de conjuro a distancia a 27m; 3d8 daño de un tipo a elección (ácido, frío, fuego, rayo, veneno o trueno). Componente material: 50 po en polvo de diamante." },
  { id: "disco-flotante-tenser", name: "Disco flotante de Tenser", level: 1, school: "conjuracion", classes: ["mago"], ritual: true, description: "Creas un disco horizontal que carga hasta 225 kg durante 1 hora, siguiendo a 6m de ti." },

  // ---------- Nivel 2 (PHB cap. 11 — subconjunto por espacio; ampliar de forma incremental) ----------
  { id: "mejorar-capacidad", name: "Mejorar capacidad", level: 2, school: "transmutacion", classes: ["bardo", "clerigo", "druida", "hechicero"], concentration: true, description: "Una criatura tocada obtiene ventaja en una prueba de habilidad elegida durante 1 hora (efectos extra por característica)." },
  { id: "paso-sin-rastro", name: "Paso sin rastro", level: 2, school: "transmutacion", classes: ["druida", "explorador"], concentration: true, description: "Tú y tus aliados dentro de 9m no dejan rastro ni olor durante hasta 1 hora." },
  { id: "trepar-arana", name: "Trepar como una araña", level: 2, school: "transmutacion", classes: ["druida", "explorador"], concentration: true, description: "El objetivo tocado puede trepar superficies difíciles durante 1 hora." },
  { id: "crecimiento-espinoso", name: "Crecimiento espinoso", level: 2, school: "transmutacion", classes: ["druida"], concentration: true, description: "Terreno en un radio de 6m se vuelve espinoso y difícil durante 10 minutos." },
  { id: "rayo-lunar", name: "Rayo lunar", level: 2, school: "evocacion", classes: ["druida"], concentration: true, description: "Silueta de luz forma un cilindro de 12m de alto; criaturas que empiezan su turno dentro reciben 2d10 radiante." },
  { id: "piel-corteza", name: "Piel de corteza", level: 2, school: "transmutacion", classes: ["druida"], concentration: true, description: "La CA del objetivo tocado no puede ser inferior a 16 durante 1 hora." },
  { id: "restauracion-menor", name: "Restauración menor", level: 2, school: "abjuracion", classes: ["bardo", "clerigo", "druida", "paladin"], description: "Fin de una enfermedad o una condición listada en el conjuro sobre una criatura tocada." },
  { id: "retener-persona", name: "Retener persona", level: 2, school: "encantamiento", classes: ["bardo", "clerigo", "druida", "hechicero", "brujo", "mago"], concentration: true, description: "Un humanoide a 18m salva SAB o queda paralizado durante 1 minuto." },
  { id: "arma-espiritual", name: "Arma espiritual", level: 2, school: "evocacion", classes: ["clerigo"], concentration: true, description: "Invocas un arma espectral que ataca como acción adicional por 1 minuto." },
  { id: "oracion-sanacion", name: "Oración de sanación", level: 2, school: "evocacion", classes: ["clerigo"], description: "Hasta 6 criaturas a 9m recuperan 2d8 + mod de lanzamiento PG si no están en combate." },
  { id: "vinculo-protector", name: "Vínculo protector", level: 2, school: "abjuracion", classes: ["clerigo"], concentration: true, description: "Un aliado tocado recibe +1 a la CA y resistencia a un tipo de daño; tú compartes daño." },
  { id: "localizar-objeto", name: "Localizar objeto", level: 2, school: "adivinacion", classes: ["bardo", "clerigo", "druida", "paladin", "explorador", "hechicero", "brujo", "mago"], concentration: true, description: "Percibes la dirección de un objeto o clase de objetos conocido durante hasta 10 minutos." },
  { id: "silencio", name: "Silencio", level: 2, school: "ilusion", classes: ["bardo", "clerigo", "hechicero", "brujo", "mago"], ritual: true, concentration: true, description: "Esfera de 6m de radio sin sonido durante 10 minutos." },
  { id: "zona-verdad", name: "Zona de la verdad", level: 2, school: "encantamiento", classes: ["bardo", "clerigo", "paladin"], concentration: true, description: "Criaturas en un cilindro de 4,5m salvan CAR o no pueden mentir durante 10 minutos." },
  { id: "telarana", name: "Telaraña", level: 2, school: "conjuracion", classes: ["hechicero", "mago"], concentration: true, description: "Masas de telas pegajosas llenan un cubo de 6m; terreno difícil y apresamiento." },
  { id: "ceguera-sordera", name: "Ceguera/sordera", level: 2, school: "transmutacion", classes: ["bardo", "clerigo", "hechicero", "mago"], description: "Una criatura a 36m salva CON o queda cegada o ensordecida durante 1 minuto." },
  { id: "imagen-espejo", name: "Imagen en el espejo", level: 2, school: "ilusion", classes: ["hechicero", "brujo", "mago"], concentration: true, description: "Tres duplicados tuyos se mueven contigo y confunden ataques durante 1 minuto." },
  { id: "invisibilidad", name: "Invisibilidad", level: 2, school: "ilusion", classes: ["bardo", "hechicero", "brujo", "mago"], concentration: true, description: "Una criatura que tocas queda invisible hasta atacar o lanzar conjuro." },
  { id: "nube-piedra", name: "Nube de dagas", level: 2, school: "conjuracion", classes: ["hechicero", "brujo", "mago"], concentration: true, description: "Esfera de dagas giratorias a 18m; daño cortante al entrar o empezar turno dentro." },
  { id: "piel-petrificante", name: "Piel petrificante", level: 2, school: "abjuracion", classes: ["hechicero", "mago"], concentration: true, description: "Reacción: +2 a la CA contra un ataque que puedas ver." },
  { id: "sugestion-masiva", name: "Sugestión en grupo", level: 2, school: "encantamiento", classes: ["bardo", "hechicero", "mago"], concentration: true, description: "Hasta 12 criaturas deben salvar SAB o seguir una sugerencia razonable durante 8 horas." },
  { id: "detectar-pensamientos", name: "Detectar pensamientos", level: 2, school: "adivinacion", classes: ["bardo", "hechicero", "brujo", "mago"], concentration: true, description: "Lees superficie mental o profundidad en criaturas dentro del alcance durante 1 minuto." },
  { id: "metal-ardiente", name: "Metal ardiente", level: 2, school: "transmutacion", classes: ["bardo", "clerigo"], concentration: true, description: "Objeto metálico caliente causa daño si se lleva o manipula durante hasta 1 minuto." },
  { id: "encontrar-trampas", name: "Encontrar trampas", level: 2, school: "adivinacion", classes: ["bardo", "clerigo", "druida", "explorador"], concentration: true, description: "Percibes trampas mágicas y mecánicas al verlas o moverte con normalidad durante 10 minutos." },
  { id: "vision-oscura-magica", name: "Visión en la oscuridad", level: 2, school: "transmutacion", classes: ["druida", "explorador", "hechicero", "mago"], concentration: true, description: "Una criatura tocada gana visión en la oscuridad 18m durante 8 horas." },
  { id: "proteccion-contra-veneno", name: "Protección contra el veneno", level: 2, school: "abjuracion", classes: ["clerigo", "druida", "paladin", "explorador"], concentration: true, description: "Una criatura tocada tiene resistencia al daño por veneno y ventaja contra venenos durante 1 hora." },
  { id: "arma-magica", name: "Arma mágica", level: 2, school: "transmutacion", classes: ["paladin"], concentration: true, description: "Un arma tocada cuenta como mágica y tiene bonificador +1 al ataque y daño durante 1 hora." },

  // --- Nivel 2 PHB (huecos frecuentes en mesa; nombres alineados con Manual del Jugador ES) ---
  { id: "auxilio", name: "Auxilio", level: 2, school: "abjuracion", classes: ["clerigo", "paladin"], concentration: true, description: "Hasta 3 criaturas tocadas aumentan su máximo y sus PG actuales en 5 cada una durante 8 horas." },
  { id: "augurio", name: "Augurio", level: 2, school: "adivinacion", classes: ["clerigo"], ritual: true, description: "Aprendes si un plan que emprenderás en los próximos 30 min será bueno o malo según lecturas de entrañas, pájaros, etc." },
  { id: "llama-eterna", name: "Llama eterna", level: 2, school: "evocacion", classes: ["clerigo", "mago"], description: "Un objeto tocado arde sin consumirse ni calentarse, emitiendo luz equivalente a una antorcha hasta que se disipe." },
  { id: "reposo-gentil", name: "Reposo gentil", level: 2, school: "nigromancia", classes: ["clerigo", "mago"], ritual: true, description: "Proteges un cadáver tocado de ser no-muerto y retrasa su putrefacción durante 10 días." },
  { id: "sugestion", name: "Sugestión", level: 2, school: "encantamiento", classes: ["bardo", "hechicero", "mago"], concentration: true, description: "Una criatura que oye tu mensaje salva SAB o sigue un curso de acción razonable durante 8 horas." },
  { id: "oscuridad", name: "Oscuridad", level: 2, school: "evocacion", classes: ["hechicero", "brujo", "mago"], concentration: true, description: "Esfera de 4,5m de radio de oscuridad mágica impenetrable a la visión normal y a la luz no mágica durante 10 minutos." },
  { id: "paso-brumoso", name: "Paso brumoso", level: 2, school: "conjuracion", classes: ["hechicero", "brujo", "mago"], description: "Acción adicional: te teletransportas hasta 9m a un lugar no ocupado que puedas ver." },
  { id: "agrandar-reducir", name: "Agrandar/reducir", level: 2, school: "transmutacion", classes: ["bardo", "druida", "hechicero", "mago"], concentration: true, description: "Una criatura u objeto que ves crece o encoge durante 1 minuto (ventajas o desventajas en combate y porte según el PHB)." },
  { id: "calmar-emociones", name: "Calmar emociones", level: 2, school: "encantamiento", classes: ["bardo", "clerigo"], concentration: true, description: "Humanoides en esfera de 6m salvan CAR o quedan indiferentes hacia criaturas elegidas; puedes suprimir ventaja por miedo o enojo." },
  { id: "calentar-metal", name: "Calentar metal", level: 2, school: "transmutacion", classes: ["bardo", "druida"], concentration: true, description: "Objeto metálico que puedas ver se calienta; quien lo lleve o toque recibe daño de fuego y penalizaciones hasta soltarlo." },
  { id: "mensajero-animales", name: "Mensajero de los animales", level: 2, school: "encantamiento", classes: ["bardo", "druida", "explorador"], ritual: true, description: "Una bestia diminuta lleva tu mensaje a un lugar que conozcas y vuelve con una respuesta corta en 24 horas." },
  { id: "hoja-llamas", name: "Hoja de llamas", level: 2, school: "evocacion", classes: ["druida"], concentration: true, description: "Invocas una hoja de fuego en tu mano libre; ataque de conjuro cuerpo a cuerpo que hace daño de fuego." },
  { id: "rafaga-viento", name: "Ráfaga de viento", level: 2, school: "evocacion", classes: ["druida", "explorador", "mago"], concentration: true, description: "Línea de 18m×3m de viento fuerte; criaturas salvan FUE o retroceden y quedan prono si son voladoras." },

  { id: "hablar-muertos", name: "Hablar con los muertos", level: 3, school: "nigromancia", classes: ["bardo", "clerigo"], description: "Devuelves la voz a un cadáver durante 10 min para responder 5 preguntas (sólo hasta 10 días de muerto)." },
  { id: "disipar-magia", name: "Disipar magia", level: 3, school: "abjuracion", classes: ["bardo", "clerigo", "druida", "paladin", "hechicero", "brujo", "mago"], description: "Fin de cualquier conjuro de nivel ≤ 3 en la criatura/objeto/efecto tocado. A niveles superiores aumenta el máximo automático." },

  // ---------- Nivel 3 (PHB — ampliación jugabilidad) ----------
  { id: "bola-fuego", name: "Bola de fuego", level: 3, school: "evocacion", classes: ["hechicero", "mago"], description: "Esfera de fuego de 6m de radio a 45m; salvación DES o 8d6 fuego." },
  { id: "rayo-relampago", name: "Rayo relámpago", level: 3, school: "evocacion", classes: ["hechicero", "mago"], description: "Línea de 30m×1,5m; salvación DES o 8d6 rayo." },
  { id: "contrahechizo", name: "Contrahechizo", level: 3, school: "abjuracion", classes: ["hechicero", "mago"], description: "Reacción: interrumpes un conjuro de nivel 3 o menor a 18m; con ranura superior anulas nivel mayor." },
  { id: "volar", name: "Volar", level: 3, school: "transmutacion", classes: ["bardo", "brujo", "hechicero", "mago"], concentration: true, description: "Una criatura tocada vuela a velocidad 18m durante hasta 10 minutos." },
  { id: "patron-hipnotico", name: "Patrón hipnótico", level: 3, school: "ilusion", classes: ["bardo", "hechicero", "brujo", "mago"], concentration: true, description: "Cubo de 9m; criaturas que lo ven salvan SAB o quedan incapacitadas hasta el final del conjuro." },
  { id: "guardianes-espirituales", name: "Guardianes espirituales", level: 3, school: "conjuracion", classes: ["clerigo"], concentration: true, description: "Espíritus giran a 4,5m de ti; enemigos que empiezan turno reciben 3d8 radiante o desventaja en tiradas de ataque." },
  { id: "animar-muertos", name: "Animar a los muertos", level: 3, school: "nigromancia", classes: ["clerigo", "mago"], description: "Invocas esqueletos o zombis que obedecen órdenes durante 24 horas." },
  { id: "llamar-relampagos", name: "Llamar a los relámpagos", level: 3, school: "conjuracion", classes: ["druida"], concentration: true, description: "Nube de tormenta en cilindro 18m de alto; cada turno puedes lanzar un rayo (3d10) a un punto." },
  { id: "revivificar", name: "Revivificar", level: 3, school: "nigromancia", classes: ["clerigo", "paladin"], description: "Devuelves la vida a una criatura muerta hace menos de 1 minuto con 1 PG." },
  { id: "quitar-maldicion", name: "Quitar maldición", level: 3, school: "abjuracion", classes: ["bardo", "clerigo", "mago", "paladin"], description: "Termina una maldición sobre una criatura u objeto tocado." },
  { id: "esperanza-faro", name: "Esperanza del faro", level: 3, school: "abjuracion", classes: ["clerigo"], concentration: true, description: "Hasta 6 criaturas en esfera de 9m tienen ventaja en salvaciones de WIS y máximo PG en curación durante 1 minuto." },
  { id: "crecer-plantas", name: "Crecimiento de plantas", level: 3, school: "transmutacion", classes: ["druida", "explorador"], description: "Vegetación en un radio de 30m queda espesa y difícil; plantas normales crecen al doble de velocidad." },
  { id: "conjurar-animales", name: "Conjurar animales", level: 3, school: "conjuracion", classes: ["druida", "explorador"], concentration: true, description: "Invocas bestias que obeceden durante 1 hora." },
  { id: "luz-diurna", name: "Luz del día", level: 3, school: "evocacion", classes: ["clerigo", "druida", "hechicero", "paladin"], description: "Objeto emite luz brillante 18m y disipa oscuridad mágica de nivel 3 o inferior." },
  { id: "manto-cruzado", name: "Manto del cruzado", level: 3, school: "evocacion", classes: ["paladin"], concentration: true, description: "Aura 9m: aliados añaden tu mod de lanzamiento al daño en una tirada de daño por turno." },
  { id: "arma-elemental", name: "Arma elemental", level: 3, school: "transmutacion", classes: ["paladin"], concentration: true, description: "Un arma tocada inflige +1d4 daño extra de ácido, frío, fuego, rayo o trueno durante 1 hora." },
  { id: "circulo-magico", name: "Círculo mágico", level: 3, school: "abjuracion", classes: ["clerigo", "mago", "paladin"], description: "Cilindro de 3m de radio protege contra tipos extraplanares y su conjuros entrantes debilitados." },
  { id: "miedo", name: "Miedo", level: 3, school: "ilusion", classes: ["bardo", "brujo", "hechicero", "mago"], concentration: true, description: "Cono de criaturas salvan SAB o huyen asustadas durante la concentración." },
  { id: "lengua-piadosa", name: "Lengua piadosa", level: 3, school: "encantamiento", classes: ["bardo", "clerigo", "paladin"], concentration: true, description: "Una criatura tocada domina un idioma elegido durante 1 hora y puede persuadir humanoides." },
  { id: "paso-nebuloso", name: "Paso nebuloso", level: 3, school: "conjuracion", classes: ["brujo", "hechicero", "mago"], concentration: true, description: "Tu cuerpo se vuelve neblina; puedes moverte por rendijas y ganar resistencia al daño no mágico." },
  { id: "onda-atronadora", name: "Onda atronadora", level: 3, school: "evocacion", classes: ["bardo", "clerigo", "hechicero", "mago"], description: "Área en cubo de 4,5m; salvación CON o 2d8 trueno y empuje 3m." },
  { id: "piromancia", name: "Pirotecnia", level: 3, school: "transmutacion", classes: ["bardo", "brujo", "hechicero", "mago"], description: "Efectos de humo, chispas o una débil explosión en cubo de 3m (ruido, luz o humo)." },
  { id: "palabra-recuperadora", name: "Palabra de recuperación", level: 3, school: "evocacion", classes: ["clerigo"], description: "Un humanoide a 9m recupera PG y puede terminar encantamiento, asustado o encantado." },
  { id: "glifo-proteccion", name: "Glifo de custodia", level: 3, school: "abjuracion", classes: ["bardo", "clerigo", "mago"], description: "Grabas una trampa mágica en objeto o superficie que puede explotar o lanzar otro conjuro si se cumple una condición." },

  // --- Nivel 3 PHB (huecos frecuentes) ---
  { id: "acelerar", name: "Acelerar", level: 3, school: "transmutacion", classes: ["bardo", "hechicero", "mago"], concentration: true, description: "Una criatura voluntaria gana acción adicional, +2 a la CA y ventaja en salvaciones de DES; al terminar el conjuro sufre letargo (PHB)." },
  { id: "lentitud", name: "Lentitud", level: 3, school: "transmutacion", classes: ["hechicero", "mago"], concentration: true, description: "Cubo de 12m; criaturas que elijas salvan SAB o quedan lentas: sólo acción o acción adicional por turno, −2 a la CA y DES, no reacciones." },
  { id: "crear-comida-agua", name: "Crear comida y agua", level: 3, school: "conjuracion", classes: ["clerigo", "paladin"], description: "Creas comida y agua que nutren hasta quince humanoides o cinco monturas durante 24 horas." },
  { id: "fingir-muerte", name: "Fingir muerte", level: 3, school: "nigromancia", classes: ["bardo", "clerigo", "mago"], ritual: true, description: "Una criatura tocada queda indetectable como viviente para magia y sensibles; resiste daño salvo críticos durante 1 hora." },
  { id: "palabra-curacion-masa", name: "Palabra de curación en masa", level: 3, school: "evocacion", classes: ["bardo", "clerigo"], description: "Acción adicional: hasta 6 criaturas que elijas a 18m recuperan 1d4 + mod de lanzamiento PG cada una." },
  { id: "lenguas", name: "Lenguas", level: 3, school: "adivinacion", classes: ["bardo", "brujo", "hechicero", "mago"], description: "Una criatura tocada entiende cualquier idioma hablado que oiga durante 1 hora; al hablar, otros oyen su mensaje en un idioma que entiendan." },
  { id: "muro-viento", name: "Muro de viento", level: 3, school: "evocacion", classes: ["druida", "explorador", "mago"], concentration: true, description: "Muro de viento fuerte de hasta 15m de largo y 3m de alto; proyectiles físicos pequeños no lo atraviesan; niebla y gases se dispersan." },
  { id: "clarividencia", name: "Clarividencia", level: 3, school: "adivinacion", classes: ["bardo", "clerigo", "hechicero", "mago"], concentration: true, description: "Creas un sensor invisible en un lugar familiar a 1,5 km; ves u oyes como si estuvieras allí (elige al lanzar)." },

  // ---------- Nivel 4 ----------
  { id: "polimorfar", name: "Polimorfar", level: 4, school: "transmutacion", classes: ["bardo", "druida", "hechicero", "mago"], concentration: true, description: "Transformas una criatura voluntaria en bestia de nivel ≤ su ND durante hasta 1 hora." },
  { id: "destierro", name: "Destierro", level: 4, school: "abjuracion", classes: ["clerigo", "hechicero", "mago", "paladin"], concentration: true, description: "Un extraplanar salva CAR o es enviado fuera durante la concentración." },
  { id: "puerta-dimensional", name: "Puerta dimensional", level: 4, school: "conjuracion", classes: ["bardo", "hechicero", "mago"], description: "Teletransportas hasta 18m a un lugar visible." },
  { id: "invisibilidad-mayor", name: "Invisibilidad mayor", level: 4, school: "ilusion", classes: ["bardo", "hechicero", "mago"], concentration: true, description: "Hasta 4 criaturas tocadas quedan invisibles hasta atacar o lanzar conjuro." },
  { id: "confusion", name: "Confusión", level: 4, school: "encantamiento", classes: ["bardo", "druida", "hechicero", "mago"], concentration: true, description: "Hasta 10 criaturas en esfera de 4,5m salvan SAB o actúan al azar durante 1 minuto." },
  { id: "controlar-agua", name: "Controlar el agua", level: 4, school: "transmutacion", classes: ["clerigo", "druida", "explorador"], concentration: true, description: "Lluvia, niebla, oleada o corriente en cubo de 9m durante 10 minutos." },
  { id: "guardian-fiel", name: "Guardián fiel", level: 4, school: "conjuracion", classes: ["clerigo"], concentration: true, description: "Espectro grande vigila 9m y ataca intrusos durante 8 horas." },
  { id: "libertad-movimiento", name: "Libertad de movimiento", level: 4, school: "abjuracion", classes: ["bardo", "clerigo", "druida", "explorador"], concentration: true, description: "Una criatura ignora terreno difícil y muchas restricciones de movimiento mágicas durante 1 hora." },
  { id: "moldear-piedra", name: "Moldear la piedra", level: 4, school: "transmutacion", classes: ["clerigo", "druida", "explorador", "mago"], description: "Excavas o moldeas piedra en cubo de 1,5m durante al menos 1 hora." },
  { id: "tormenta-hielo", name: "Tormenta de hielo", level: 4, school: "evocacion", classes: ["druida", "explorador", "hechicero", "mago"], description: "Cilindro de granizo en radio 12m; salvación DES o daño contundente y frío." },
  { id: "escudo-fuego", name: "Escudo de fuego", level: 4, school: "evocacion", classes: ["hechicero", "mago"], concentration: true, description: "Llamas te rodean 3m; ataques cuerpo a cuerpo reciben daño de fuego de vuelta." },
  { id: "debilitamiento", name: "Debilitamiento", level: 4, school: "nigromancia", classes: ["brujo", "hechicero", "mago"], concentration: true, description: "Una criatura a 9m salva CON o recibe daño necrótico y no puede curar hasta el final de tu siguiente turno." },
  { id: "asesino-fantasmal", name: "Asesino fantasmal", level: 4, school: "ilusion", classes: ["hechicero", "mago"], concentration: true, description: "La criatura ve su peor miedo y recibe daño psíquico cada turno si falla salvaciones." },
  { id: "localizar-criatura", name: "Localizar criatura", level: 4, school: "adivinacion", classes: ["bardo", "clerigo", "druida", "explorador", "mago"], concentration: true, description: "Percibes dirección y distancia de una criatura conocida durante hasta 1 hora." },
  { id: "aura-vitalidad", name: "Aura de vitalidad", level: 4, school: "evocacion", classes: ["paladin"], concentration: true, description: "Aura 9m que puede curar con acción bonus durante 1 minuto." },
  { id: "marcado-cazador-nv4", name: "Marcado del cazador", level: 4, school: "abjuracion", classes: ["explorador"], concentration: true, description: "Marcas una criatura; tus ataques siguen mejor contra ella durante la duración." },

  // ---------- Nivel 5 ----------
  { id: "telequinesis", name: "Telequinesis", level: 5, school: "transmutacion", classes: ["brujo", "hechicero", "mago"], concentration: true, description: "Levantas criaturas u objetos pesados o proyectas fuerza telequinética durante hasta 10 minutos." },
  { id: "animar-objetos", name: "Animar objetos", level: 5, school: "transmutacion", classes: ["bardo", "hechicero", "mago"], concentration: true, description: "Das vida a objetos que obedecen durante 1 minuto." },
  { id: "dominar-persona", name: "Dominar persona", level: 5, school: "encantamiento", classes: ["bardo", "brujo", "hechicero", "mago"], concentration: true, description: "Un humanoide salva SAB o queda bajo tu control durante 1 minuto." },
  { id: "cono-frio", name: "Cono de frío", level: 5, school: "evocacion", classes: ["hechicero", "mago"], description: "Cono de frío intenso; salvación CON o gran daño frío." },
  { id: "muro-fuerza", name: "Muro de fuerza", level: 5, school: "evocacion", classes: ["hechicero", "mago"], concentration: true, description: "Pared invisible indestructible que bloquea efectos durante 10 minutos." },
  { id: "niebla-mortifera", name: "Niebla letal", level: 5, school: "conjuracion", classes: ["hechicero", "mago"], concentration: true, description: "Esfera de gas venenoso que obstruye vista y daña cada turno." },
  { id: "conjurar-elemental", name: "Conjurar elemental", level: 5, school: "conjuracion", classes: ["druida"], concentration: true, description: "Invocas un elemental que obedece hasta 1 hora." },
  { id: "cura-masiva", name: "Curación en masa", level: 5, school: "evocacion", classes: ["clerigo", "druida"], description: "Varias criaturas en esfera recuperan PG." },
  { id: "gran-restauracion", name: "Gran restauración", level: 5, school: "abjuracion", classes: ["bardo", "clerigo", "druida"], description: "Reduce exhaustión y termina varias aflicciones mágicas." },
  { id: "revivir-mayor", name: "Revivir a los muertos", level: 5, school: "nigromancia", classes: ["bardo", "clerigo", "paladin"], description: "Devuelves la vida a una criatura muerta hace menos de 1 día." },
  { id: "dominar-bestia", name: "Dominar bestia", level: 5, school: "encantamiento", classes: ["druida", "explorador"], concentration: true, description: "Una bestia salva SAB o queda bajo tu control durante la concentración." },
  { id: "conjurar-andanada", name: "Conjurar andanada", level: 5, school: "conjuracion", classes: ["explorador"], concentration: true, description: "Un proyectil golpea cada criatura en área ante ti al disparar arma a distancia." },
  { id: "onda-destructiva", name: "Onda destructora", level: 5, school: "evocacion", classes: ["paladin"], description: "Onda sagrada daña enemigos y puede curar aliados en radio alrededor tuyo según tirada." },

  // ---------- Nivel 6 ----------
  { id: "cadena-relampagos", name: "Cadena de relámpagos", level: 6, school: "evocacion", classes: ["hechicero", "mago"], description: "Rayo que salta entre objetivos y puede dañar a varios." },
  { id: "circulo-muerte", name: "Círculo de la muerte", level: 6, school: "nigromancia", classes: ["hechicero", "mago"], description: "Esfera de energía necrótica; salvación CON o daño masivo." },
  { id: "desintegrar", name: "Desintegrar", level: 6, school: "transmutacion", classes: ["hechicero", "mago"], description: "Rayo verde que puede destruir objetos o criaturas grandes si fallan salvación." },
  { id: "globo-invulnerabilidad", name: "Globo de invulnerabilidad", level: 6, school: "abjuracion", classes: ["hechicero", "mago"], concentration: true, description: "Esfera anti-conjuros de nivel bajo centrada en ti durante la concentración." },
  { id: "cura-masiva-grupo", name: "Curación en masa grupal", level: 6, school: "evocacion", classes: ["clerigo"], description: "Curas hasta seis criaturas a la vez en gran radio." },
  { id: "cura-heridas-mayor", name: "Curar heridas mayor", level: 6, school: "evocacion", classes: ["bardo", "clerigo", "druida"], description: "Curación intensa y puede terminar cegado o ensordecido." },
  { id: "conjurar-fey", name: "Conjurar feérico", level: 6, school: "conjuracion", classes: ["bardo", "druida"], concentration: true, description: "Invocas aliado feérico que obedece durante el tiempo del conjuro." },
  { id: "oir-pensamiento", name: "Oír pensamientos", level: 6, school: "adivinacion", classes: ["bardo", "clerigo", "mago"], concentration: true, description: "Lees mentes en una esfera alrededor de ti durante la concentración." },
  { id: "contingencia", name: "Contingencia", level: 6, school: "evocacion", classes: ["mago"], description: "Almacenas un conjuro que se libera al cumplirse una condición que fijas." },
  { id: "trampa-magica", name: "Trampa mágica", level: 6, school: "abjuracion", classes: ["mago"], concentration: true, description: "Proteges un área con efectos que dispara al entrar." },
  { id: "transporte-arboles", name: "Transportarse por árboles", level: 6, school: "conjuracion", classes: ["druida"], concentration: true, description: "Entras en una planta Garganta y puedes surgir de otra planta del mismo tipo hasta 450m." },
  { id: "palabra-retorno", name: "Palabra de regreso", level: 6, school: "conjuracion", classes: ["clerigo"], description: "Teletransportas aliados voluntarios a un santuario seguro." },
  { id: "muro-hielo", name: "Muro de hielo", level: 6, school: "evocacion", classes: ["mago"], concentration: true, description: "Pared de hielo semitransparente que puede dañar en contacto y obstruye línea de visión." },

  // ---------- Nivel 7 ----------
  { id: "teletransportar", name: "Teletransportar", level: 7, school: "conjuracion", classes: ["bardo", "hechicero", "mago"], description: "Teletransportas hasta ocho criaturas voluntarias a un lugar conocido del mismo plano." },
  { id: "dedo-muerte", name: "Dedo de la muerte", level: 7, school: "nigromancia", classes: ["hechicero", "mago"], description: "Una criatura salva CON o muere al instante (o gran daño necrótico si tiene muchos PG)." },
  { id: "chorro-prismatico", name: "Chorro prismático", level: 7, school: "evocacion", classes: ["hechicero", "mago"], description: "Cono de rayos multicolor aleatorios con efectos por color (fuego, ácido, etc.)." },
  { id: "jaula-fuerza", name: "Jaula invisible de fuerza", level: 7, school: "evocacion", classes: ["hechicero", "mago"], concentration: true, description: "Cubo invisible de fuerza mágica que atrapa criaturas sin permitir teleportación física ordinaria." },
  { id: "tormenta-fuego", name: "Tormenta de fuego", level: 7, school: "evocacion", classes: ["druida", "hechicero", "mago"], description: "Columnas de fuego caen en varias zonas causando gran daño." },
  { id: "resucitar", name: "Resucitar", level: 7, school: "nigromancia", classes: ["bardo", "clerigo"], description: "Devuelves la vida sin penalización de tiempo si el alma está dispuesta." },
  { id: "conjurar-celestial", name: "Conjurar celestial", level: 7, school: "conjuracion", classes: ["clerigo"], concentration: true, description: "Invocas un celestial que obedece durante la duración." },
  { id: "proyeccion-eterea", name: "Proyección etérea", level: 7, school: "transmutacion", classes: ["bardo", "brujo", "clerigo", "hechicero", "mago"], description: "Tú y aliados tocados cruzáis al plano Etéreo brevemente o recorréis allí durante el tiempo indicado." },
  { id: "regenerar", name: "Regenerar", level: 7, school: "transmutacion", classes: ["bardo", "clerigo", "druida"], concentration: true, description: "Regenera órganos perdidos y termina efectos exhaustivos graves en la criatura tocada durante 1 hora." },

  // ---------- Nivel 8 ----------
  { id: "dominar-monstruo", name: "Dominar monstruo", level: 8, school: "encantamiento", classes: ["bardo", "brujo", "hechicero", "mago"], concentration: true, description: "Una criatura salva SAB o queda bajo tu control durante la concentración." },
  { id: "debilitamiento-mayor", name: "Debilitamiento mental", level: 8, school: "encantamiento", classes: ["bardo", "brujo", "hechicero", "mago"], concentration: true, description: "Inteligencia y carisma caen a 1 salvo salvación especial." },
  { id: "palabra-poder-atontar", name: "Palabra de poder: atontar", level: 8, school: "encantamiento", classes: ["bardo", "brujo", "clerigo", "hechicero", "mago"], description: "Una criatura queda atontada o tiene un efecto menor si tiene muchos PG." },
  { id: "terremoto", name: "Terremoto", level: 8, school: "transmutacion", classes: ["clerigo", "druida", "hechicero", "mago"], concentration: true, description: "El suelo se agrieta en un vasto radio; criaturas caen o quedan atrapadas." },
  { id: "nube-mortifera", name: "Nube aniquiladora", level: 8, school: "conjuracion", classes: ["druida", "hechicero", "mago"], concentration: true, description: "Nube negra que obstruye y puede disolver criaturas que fallen salvación." },
  { id: "mente-en-blanco", name: "Mente en blanco", level: 8, school: "abjuracion", classes: ["bardo", "hechicero", "mago"], description: "La criatura es inmune a lectura mental y ventaja contra otros efectos mentales durante 24 horas." },

  // ---------- Nivel 9 ----------
  { id: "deseo", name: "Deseo", level: 9, school: "conjuracion", classes: ["hechicero", "mago"], description: "Alteras la realidad con un deseo verbal; estrés si excedes los límites seguros." },
  { id: "lluvia-meteoritos", name: "Lluvia de meteoritos", level: 9, school: "evocacion", classes: ["hechicero", "mago"], description: "Grandes meteoritos devastan una zona enorme." },
  { id: "polimorfar-verdadero", name: "Polimorfar verdadero", level: 9, school: "transmutacion", classes: ["bardo", "druida", "hechicero", "mago"], concentration: true, description: "Transformas una criatura en cualquier forma de criatura sin límite de ND durante la duración." },
  { id: "puerta-extraplanar", name: "Puerta extraplanar", level: 9, school: "conjuracion", classes: ["clerigo", "hechicero", "mago"], concentration: true, description: "Abres un portal de dos caras hacia otro plano durante 1 minuto." },
  { id: "premonicion", name: "Premoniciones", level: 9, school: "adivinacion", classes: ["bardo", "druida", "hechicero", "mago"], concentration: true, description: "No puedes ser sorprendido y ventaja en salvaciones y ataques durante 8 horas." },
  { id: "tormenta-vencedora", name: "Tormenta del vencedor divino", level: 9, school: "conjuracion", classes: ["clerigo"], concentration: true, description: "Tormenta divina que daña enemigos y cura aliados en un radio enorme." },
  { id: "palabra-poder-matar", name: "Palabra de poder: matar", level: 9, school: "encantamiento", classes: ["bardo", "brujo", "clerigo", "hechicero", "mago"], description: "Una criatura muere al instante o recibe gran daño necrótico si tiene demasiados PG." },
];

export function spellsForClassAtLevel(classId: SpellClassId, level: number): Spell[] {
  return SPELLS.filter((s) => s.classes.includes(classId) && s.level === level);
}

/** Conjuros de la lista de clase desde trucos hasta `maxSpellLevel` inclusive. */
export function spellsForClassUpToLevel(classId: SpellClassId, maxSpellLevel: number): Spell[] {
  const cap = Math.min(9, Math.max(0, maxSpellLevel));
  return SPELLS.filter((s) => s.classes.includes(classId) && s.level <= cap).sort((a, b) =>
    a.level !== b.level ? a.level - b.level : a.name.localeCompare(b.name, "es"),
  );
}

export function findSpellByName(name: string): Spell | undefined {
  const n = name.trim().toLowerCase();
  return SPELLS.find((s) => s.name.toLowerCase() === n || s.id === n);
}

export type SpellKnownRow = { name: string; level: number; prepared: boolean };

/**
 * PHB (clérigo / druida / paladín): preparas desde la lista completa de conjuros de tu clase
 * hasta el nivel de ranura que puedes usar. Personajes antiguos pueden tener solo un subconjunto
 * en `known`; se fusiona con `SPELLS` conservando el flag `prepared` por nombre+nivel.
 */
export function mergePreparedCasterKnownWithCatalog(
  classId: SpellClassId,
  maxSpellLevel: number,
  known: SpellKnownRow[],
): SpellKnownRow[] {
  const cap = Math.min(9, Math.max(0, maxSpellLevel));
  const full = spellsForClassUpToLevel(classId, cap);
  const sortKnown = (rows: SpellKnownRow[]) =>
    [...rows].sort((a, b) => (a.level !== b.level ? a.level - b.level : a.name.localeCompare(b.name, "es")));
  // Sin entradas en catálogo a este techo (p. ej. paladín nv. 1 sin trucos de lista): no fusionar.
  if (full.length === 0) return sortKnown(known);
  const keyOf = (name: string, level: number) => `${level}:${name.trim().toLowerCase()}`;
  const preparedByKey = new Map<string, boolean>();
  for (const row of known) {
    const spell = findSpellByName(row.name);
    const key = spell ? keyOf(spell.name, spell.level) : keyOf(row.name, row.level);
    preparedByKey.set(key, row.prepared);
  }
  const out: SpellKnownRow[] = [];
  for (const s of full) {
    const key = keyOf(s.name, s.level);
    const prev = preparedByKey.get(key);
    const prepared = s.level === 0 ? true : prev ?? false;
    out.push({ name: s.name, level: s.level, prepared });
  }
  for (const row of known) {
    const spell = findSpellByName(row.name);
    const inClassCatalog =
      spell != null &&
      spell.classes.includes(classId) &&
      spell.level <= cap &&
      spell.name.trim().toLowerCase() === row.name.trim().toLowerCase();
    if (inClassCatalog) continue;
    out.push({ ...row });
  }
  return sortKnown(out);
}
