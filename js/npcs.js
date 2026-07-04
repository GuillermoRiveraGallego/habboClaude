"use strict";

// ============================================================
// NPCS — vecinos con los que hablar. Todo basado en datos: cada
// NPC tiene aspecto propio (se dibuja con el cuerpo voxel del
// Avatar) y un guion de conversación.
//
// Hay dos clases de NPC:
// - FIJOS: viven siempre en una casilla de su sala.
// - VISITANTES: "de visita" — el calendario decide quién viene
//   cada día (rotación determinista por número de día, con días
//   sin visita); cada visitante tiene varios puestos posibles.
//   forzarVisita(id | null | undefined) lo controla en pruebas.
//
// Motor de respuesta (sin IA ni backend): primero se buscan
// PALABRAS CLAVE simples en el mensaje del jugador (temas); si
// ninguna encaja, responde una frase genérica aleatoria evitando
// repetir la última. Las claves se escriben en minúsculas y SIN
// acentos ni diacríticos: el texto del jugador se normaliza
// antes de comparar (sirve también para el rumano: ă→a, ș→s...).
// ============================================================
var Npcs = (function () {

  var FIJOS = [
    {
      id: "antonio", nombre: "Abuelo Antonio", emoji: "⚽", sala: 0, x: 2, y: 4, dir: 1,
      aspecto: { peinado: "rapado", pelo: "blanco", piel: "piel",
                 camiseta: "azul", pantalon: "gris_oscuro", zapatos: "blanco" },
      saludos: [
        "¡Muy buenas, chaval! Soy Antonio. ¿Viste anoche el partidazo de fútbol sala?",
        "¡Hombre, por fin alguien con quien hablar! Siéntate, que te cuento una jugada."
      ],
      temas: [
        { claves: ["hola", "buenas", "que tal", "hey"],
          respuestas: ["¡Muy buenas! Aquí, repasando alineaciones de cabeza.",
                       "¡Hola, hola! ¿Tú juegas al fútbol sala? Tienes pinta de ala-cierre."] },
        { claves: ["futbol", "futsal", "pelota", "balon", "gol", "porteria", "partido"],
          respuestas: ["El fútbol sala es el deporte rey, digan lo que digan. Todo toque, todo cabeza.",
                       "Yo jugaba de cierre, ¿eh? Y tenía un disparo que rompía redes... y alguna ventana.",
                       "Cuarenta por veinte, cinco contra cinco y el doble penalti. ¡Eso es un deporte serio!"] },
        { claves: ["messa", "messi", "argentino", "leo"],
          respuestas: ["¿Leo Messa? Ese chaval tiene una zurda de oro. A veces viene de visita, estate atento.",
                       "Con Messa jugaría hasta yo, y eso que la rodilla ya no me deja ni celebrar."] },
        { claves: ["credito", "dinero", "minijuego", "ordenador"],
          respuestas: ["Yo con el ordenador no me aclaro, pero mi nieto Guille dice que sus jueguecitos dan créditos.",
                       "En mis tiempos el dinero se ganaba sudando. Ahora, jugando al ordenador. ¡Qué invento!"] },
        { claves: ["tarea", "diaria", "reto"],
          respuestas: ["Cada día sus tareas, como toda la vida: entreno por la mañana y partido por la tarde."] },
        { claves: ["adios", "chao", "hasta luego", "me voy"],
          respuestas: ["Con Dios, chaval. ¡Y chuta fuerte, siempre abajo y cruzado!"] }
      ],
      genericas: [
        "En mis tiempos esto era un descampado y jugábamos con porterías de piedras.",
        "¿Eso tiene que ver con el fútbol sala? Si no, me pierdo un poco.",
        "Espera, que estaba pensando en la semifinal del 87... ¿qué decías?",
        "Pregúntame de fútbol sala, que de eso no me gana nadie."
      ]
    },
    {
      id: "guille", nombre: "Guille", emoji: "💻", sala: 1, x: 4, y: 3, dir: 1,
      aspecto: { peinado: "tupe", pelo: "madera_oscura", piel: "piel",
                 camiseta: "negro", pantalon: "azul", zapatos: "blanco" },
      saludos: [
        "¡Ey! Soy Guille, el creador de este juego. Sí, TODO esto lo programé yo. De nada.",
        "¡Anda, un jugador! Cuidado con tocar mucho, que esto lo compilé con cariño... y sin tests. Es broma. ¿O no?"
      ],
      temas: [
        { claves: ["hola", "buenas", "que tal", "hey"],
          respuestas: ["¡Ey! Bienvenido a mi obra maestra. Modestia aparte, claro.",
                       "¿Qué tal? Yo aquí, vigilando que no se caiga el framerate."] },
        { claves: ["bug", "error", "fallo", "roto", "no funciona"],
          respuestas: ["¿Un bug? Imposible. Eso es una feature no documentada 😏",
                       "Si algo falla, prueba a recargar. Truco de programador senior."] },
        { claves: ["juego", "crear", "programar", "codigo", "javascript", "creador"],
          respuestas: ["Todo esto está dibujado con código: canvas y JavaScript, sin una sola imagen. Horas de mi vida en cada cubito.",
                       "¿Sabes que el sombreado lo calcula un módulo que se llama Iso? Le tengo cariño hasta a las variables."] },
        { claves: ["credito", "dinero", "truco", "cheat", "trampa"],
          respuestas: ["¿Trucos? Los quité todos... bueno, casi todos. Sigue jugando, tramposo.",
                       "El mejor truco: tareas diarias + minijuegos. Firmado: el que programó la economía."] },
        { claves: ["tarea", "consejo", "ayuda"],
          respuestas: ["Consejo del creador: reclama las tareas cada día y habla con todos los vecinos. Sé de buena tinta que dan premio."] },
        { claves: ["adios", "chao", "hasta luego", "me voy"],
          respuestas: ["Venga, sigue jugando, que para eso lo hice. ¡Y no rompas nada!"] }
      ],
      genericas: [
        "Eso lo programé un martes a las 2 de la mañana, mejor no lo toques mucho.",
        "Interesante... lo apunto para la versión 2.0.",
        "Error 404: respuesta no encontrada. Es broma, sigue, sigue.",
        "¿Eso es una petición de feature? Ponte a la cola 😜"
      ]
    },
    {
      id: "ion", nombre: "Ion", emoji: "🧱", sala: 2, x: 5, y: 4, dir: 1,
      aspecto: { peinado: "rapado", pelo: "negro", piel: "piel",
                 camiseta: "naranja", pantalon: "gris", zapatos: "negro" },
      saludos: [
        "Salut, șefu'! Ion mă cheamă. Dacă ai nevoie de-o reformă, eu sunt omul tău.",
        "Bună! Tocmai măsuram peretele ăsta. Are 2 milimetri strâmb... inacceptabil!"
      ],
      temas: [
        { claves: ["hola", "buenas", "salut", "buna"],
          respuestas: ["Salut, salut! Azi terminăm șapa, mâine punem gresia. Totul la milimetru!"] },
        { claves: ["obra", "reforma", "pared", "suelo", "ladrillo", "azulejo",
                   "perete", "podea", "gresie", "faianta", "santier", "caramida"],
          respuestas: ["Gresie, faianță, șapă și rigips — le fac pe toate, șefu'. Meserie curată!",
                       "Peretele ăsta îl dărâm și îl ridic la loc într-o zi. Fără praf, fără probleme!",
                       "Aticul ăsta are potențial: două coloane afară, tavan fals... îți fac un palat!"] },
        { claves: ["precio", "cuanto", "presupuesto", "cat costa", "pret"],
          respuestas: ["Îți fac un preț bun, șefu'. Jumate acum, jumate la final. Cu factură, că suntem serioși!"] },
        { claves: ["gracias", "multumesc", "mersi"],
          respuestas: ["Cu plăcere, șefu'! Spune-i și vecinului de mine, că am agenda goală joia."] },
        { claves: ["mamitica", "mama", "comida", "mancare"],
          respuestas: ["Mamitica? Vai, ce sarmale face femeia aia... pentru o farfurie îți zugrăvesc casa gratis!"] },
        { claves: ["adios", "chao", "hasta luego", "pa pa"],
          respuestas: ["Hai, să trăiești! Mâine vin la prima oră... pe la 11, așa."] }
      ],
      genericas: [
        "Nu înțeleg chiar tot, dar dau din cap: da, da, se poate face.",
        "Asta se rezolvă cu ciment și răbdare, crede-mă.",
        "Șefu', în România făceam asta cu ochii închiși.",
        "O clipă, că îmi sună nivela... zic eu ceva și nu greșesc: se poate!"
      ]
    },
    {
      id: "ioana", nombre: "Ioana", emoji: "📣", sala: 4, x: 3, y: 1, dir: 1, baila: true,
      aspecto: { peinado: "melena", pelo: "madera_oscura", piel: "piel",
                 camiseta: "turquesa", pantalon: "negro", zapatos: "rojo" },
      saludos: [
        "¡Hola! Soy Ioana, experta en marketing y organización de eventos. Esta sala lleva mi sello.",
        "¡Bienvenido al evento! Bueno, todavía no hay evento, pero lo estoy organizando. Va a ser ÉPICO."
      ],
      temas: [
        { claves: ["hola", "buenas", "que tal", "hey"],
          respuestas: ["¡Hola, hola! Justo estaba probando la pista. Todo tiene que estar perfecto."] },
        { claves: ["evento", "fiesta", "organizar", "plan"],
          respuestas: ["Una buena fiesta son tres cosas: luces, música y que se hable de ella tres días después.",
                       "Estoy preparando el evento del siglo aquí mismo. Solo faltan detalles... y presupuesto."] },
        { claves: ["marketing", "promocion", "publicidad", "redes", "viral", "campana"],
          respuestas: ["El secreto del marketing: que parezca exclusivo. Por eso la bola de disco hay que ganársela.",
                       "Con una buena campaña, hasta el gnomo del jardín sería tendencia."] },
        { claves: ["baile", "bailar", "musica", "pista", "luces", "bola"],
          respuestas: ["La pista cambia de color sola: perfecta para los vídeos promocionales.",
                       "Si completas la tarea 'Noche de fiesta', tu avatar baila solo. Contenido viral asegurado."] },
        { claves: ["adios", "chao", "hasta luego", "me voy"],
          respuestas: ["¡Nos vemos en el próximo evento! Y trae invitados, que la lista está corta."] }
      ],
      genericas: [
        "Interesante... lo anoto para el plan de comunicación.",
        "Eso, con buen marketing, se vende solo.",
        "Perdona, estaba contestando mensajes del evento. ¿Decías?",
        "Háblame de eventos, fiestas o promoción: es mi terreno."
      ]
    },
    {
      id: "nacho", nombre: "Nacho", emoji: "🔌", sala: 4, x: 6, y: 1, dir: 1,
      aspecto: { peinado: "clasico", pelo: "madera", piel: "piel",
                 camiseta: "amarillo", pantalon: "azul", zapatos: "negro" },
      saludos: [
        "¡Buenas! Soy Nacho, el electricista de la disco. ¿Sabes qué le dice un cable a otro? 'Somos in-tocables'.",
        "¡Chispas! Digo... ¡hola! Nacho, electricista. Espera, que empalmo esto y te cuento un chiste."
      ],
      temas: [
        { claves: ["hola", "buenas", "que tal", "hey"],
          respuestas: ["¡Hola! Los electricistas somos gente de mucha corriente, ya verás."] },
        { claves: ["luz", "luces", "foco", "electricidad", "cable", "enchufe", "neon"],
          respuestas: ["Estas luces las instalé yo. Si parpadean no es un fallo: es ambientazo.",
                       "¿El truco del oficio? Respetar al diferencial. Ese señor no perdona."] },
        { claves: ["chiste", "otro", "broma", "risa", "gracioso", "cuentame"],
          respuestas: ["¿Cuál es el colmo de un electricista? Que su mujer se llame Luz y sus hijos le sigan la corriente.",
                       "¿Qué le dice un semáforo a otro? No me mires, que me pongo rojo.",
                       "Van dos en moto y se cae el del medio.",
                       "¿Qué hace una abeja en el gimnasio? ¡Zum-ba!",
                       "Le dije al médico: 'me duele el brazo al levantarlo'. ¿Solución? Ya no lo levanto."] },
        { claves: ["ioana", "fiesta", "evento"],
          respuestas: ["Ioana me tiene frito: que si más focos, que si más neón... ¡esto va a acabar siendo Las Vegas!"] },
        { claves: ["adios", "chao", "hasta luego", "me voy"],
          respuestas: ["¡Me piro, que salta el plomo! ...Era broma. ¿O no?"] }
      ],
      genericas: [
        "Eso me recuerda un chiste... pero te lo cuento cuando pagues la luz.",
        "¿Sabes cuál es el animal más antiguo? La cebra, que aún está en blanco y negro.",
        "Mi corriente favorita es la del viernes por la tarde: la de irme a casa.",
        "Pídeme un chiste, que los tengo recién cargados."
      ]
    },
    {
      id: "marta", nombre: "Marta", emoji: "💊", sala: 3, x: 2, y: 7, dir: 0,
      aspecto: { peinado: "coleta", pelo: "negro", piel: "piel",
                 camiseta: "blanco", pantalon: "verde_oscuro", zapatos: "blanco" },
      saludos: [
        "¿Y tú qué miras, cara alpargata? Anda, acércate, que no muerdo... mucho. Soy Marta, la farmacéutica.",
        "Uy, mira quién viene: el bobo del pueblo. ¿Qué quieres, una tirita?"
      ],
      temas: [
        { claves: ["hola", "buenas", "que tal", "hey"],
          respuestas: ["'Hola', dice. Qué elocuencia, melón. Buenas tardes tengas tú también."] },
        { claves: ["medicina", "farmacia", "pastilla", "enfermo", "dolor", "jarabe", "receta", "tirita"],
          respuestas: ["¿Te duele algo? ¿La cabeza? ¿De tanto pensar? No, eso no te pasa a ti, zoquete. Manzanilla y a correr.",
                       "Para la espalda, paracetamol. Para esa cara de pasmarote no me queda nada, lo siento."] },
        { claves: ["planta", "hierba", "jardin", "flor"],
          respuestas: ["Estoy recogiendo hierbas medicinales, no como tú, que estás de pasmarote mirando."] },
        { claves: ["guapa", "amable", "simpatica", "gracias", "maja"],
          respuestas: ["No me hagas la pelota, percebe, que las medicinas cuestan lo mismo.",
                       "Vaya, el bobo tiene modales. Ya me caes un poquito menos mal."] },
        { claves: ["boba", "tonta", "fea", "antipatica", "borde"],
          respuestas: ["¿Perdona? A mí me respetas, cabeza de chorlito: yo insulto con cariño y tú sin gracia ninguna."] },
        { claves: ["adios", "chao", "hasta luego", "me voy"],
          respuestas: ["Sí, sí, vete, cara alpargata. Y no vuelvas... hasta mañana, que me aburro."] }
      ],
      genericas: [
        "Lo que hay que oír. Anda que no eres bobo ni nada.",
        "Ajá, claro, claro... ¿tú te escuchas, melón?",
        "Mira, te voy a cobrar la consulta por pesado.",
        "No he entendido nada, cara alpargata, pero seguro que era una tontería."
      ]
    }
  ];

  var VISITANTES = [
    {
      id: "leo_messa", nombre: "Leo Messa", emoji: "🐐", visita: true, dir: 1,
      puestos: [{ sala: 3, x: 5, y: 2, dir: 1 }, { sala: 0, x: 7, y: 5, dir: 3 }],
      aspecto: { peinado: "clasico", pelo: "madera_oscura", piel: "piel",
                 camiseta: "azul_claro", pantalon: "negro", zapatos: "azul" },
      saludos: [
        "¡Che, qué hacés! Soy Leo Messa. Ando de visita, necesitaba despejarme un poco.",
        "Buenas... shhh, tranquilo, sin fotos. Vine de incógnito, viste."
      ],
      temas: [
        { claves: ["hola", "buenas", "che", "que tal"],
          respuestas: ["¡Todo bien! Este lugar tiene su onda, che."] },
        { claves: ["futbol", "gol", "balon", "pelota", "jugar", "partido"],
          respuestas: ["La pelota siempre al pie, viste. Acá adentro no se puede picar, una lástima.",
                       "¿Un partidito? Dale, pero te aviso: no pierdo ni a las bochas."] },
        { claves: ["messi", "mejor", "balon de oro", "idolo", "crack"],
          respuestas: ["Yo soy Leo MESSA, ¿eh? Cualquier parecido con otro zurdo es pura casualidad... viste.",
                       "¿El mejor de la historia? Qué sé yo... bueno, sí."] },
        { claves: ["argentina", "mate", "asado", "rosario"],
          respuestas: ["Extraño el mate y el asado, pero acá se está tranquilo, nadie te pide selfies."] },
        { claves: ["antonio", "abuelo"],
          respuestas: ["El abuelo Antonio sabe más de fútbol sala que muchos técnicos, te lo digo yo."] },
        { claves: ["adios", "chao", "hasta luego", "me voy"],
          respuestas: ["Nos vemos, que ando de gira. ¡Cuidate, che!"] }
      ],
      genericas: [
        "Qué sé yo, che... puede ser.",
        "Eso en Rosario se dice distinto, viste.",
        "Tranqui, tranqui, todo bien.",
        "Preguntame de fútbol, que de eso algo entiendo."
      ]
    },
    {
      id: "mamitica", nombre: "La Mamitica", emoji: "🥘", visita: true, dir: 3,
      puestos: [{ sala: 0, x: 4, y: 6, dir: 3 }, { sala: 3, x: 3, y: 3, dir: 1 }],
      aspecto: { peinado: "coleta", pelo: "gris", piel: "piel",
                 camiseta: "rosa", pantalon: "morado", zapatos: "negro" },
      saludos: [
        "Bună, puiule! A venit Mamitica în vizită... și am adus sarmale proaspete!",
        "Vai, ce slab ești! Stai jos, că îți pun ceva de mâncare imediat."
      ],
      temas: [
        { claves: ["hola", "buenas", "salut", "buna"],
          respuestas: ["Bună, bună, puiule! Ce mai faci? Ai dormit bine? Ai mâncat?"] },
        { claves: ["comida", "comer", "hambre", "mancare", "sarmale", "ciorba"],
          respuestas: ["Ai mâncat ceva azi? Stai să-ți pun o farfurie de ciorbă, nu se discută!",
                       "Sarmale, mămăligă și cozonac — asta da mâncare, nu pixeli de-ai voștri!"] },
        { claves: ["mascota", "perro", "gato", "animal", "caine", "pisica"],
          respuestas: ["Vai, ce drăguțe sunt animăluțele! Le-am adus și lor ceva bun de la mine."] },
        { claves: ["gracias", "multumesc", "mersi"],
          respuestas: ["Pentru puțin, puiule! Hai, mai ia o porție, că e făcută cu drag."] },
        { claves: ["familia", "casa", "hijo", "copil"],
          respuestas: ["Casa fără copii și musafiri e goală, puiule. Bine că ai venit tu!"] },
        { claves: ["ion", "albanil", "obra"],
          respuestas: ["Ion? Băiat bun, muncitor. Îi las mereu o caserolă la șantier."] },
        { claves: ["adios", "chao", "hasta luego", "pa pa"],
          respuestas: ["Pa, pa, puiule! Să te îmbraci gros, că afară e frig!"] }
      ],
      genericas: [
        "Doamne, Doamne... ce vremuri!",
        "Nu te-am înțeles, puiule, dar sigur ai dreptate tu.",
        "Ia și mănâncă ceva, că ești tare slab!",
        "Lasă, lasă, Mamitica le rezolvă pe toate."
      ]
    }
  ];

  // última genérica dicha por cada NPC (efímero, para no repetir)
  var ultimaGen = {};

  // ---------------- visitante del día ----------------

  // undefined = decide el calendario · null = sin visita · objeto = ese NPC
  var visitaForzada;
  var visCache = { dia: -1, npc: null };

  function diaNumero() { return Math.floor(Date.now() / 86400000); }

  function ponPuesto(v, p) {
    v.sala = p.sala;
    v.x = p.x;
    v.y = p.y;
    v.dir = p.dir || 0;
  }

  // Rotación determinista: un hueco más que visitantes, así hay
  // días sin visita ("de vez en cuando viene alguien").
  function visitanteDeHoy() {
    var n = diaNumero();
    if (visCache.dia === n) return visCache.npc;
    var ciclo = VISITANTES.length + 1;
    var npc = null;
    if (n % ciclo < VISITANTES.length) {
      npc = VISITANTES[n % ciclo];
      ponPuesto(npc, npc.puestos[Math.floor(n / ciclo) % npc.puestos.length]);
    }
    visCache = { dia: n, npc: npc };
    return npc;
  }

  function visitanteActual() {
    if (visitaForzada !== undefined) return visitaForzada;
    return visitanteDeHoy();
  }

  // Para pruebas y escenas: forzarVisita("id") | null (nadie) |
  // sin argumento (vuelve al calendario)
  function forzarVisita(id) {
    if (id === undefined || id === null) {
      visitaForzada = (id === null) ? null : undefined;
      return;
    }
    for (var i = 0; i < VISITANTES.length; i++) {
      if (VISITANTES[i].id === id) {
        ponPuesto(VISITANTES[i], VISITANTES[i].puestos[0]);
        visitaForzada = VISITANTES[i];
        return;
      }
    }
  }

  // ---------------- consultas ----------------

  function lista() { return FIJOS.concat(VISITANTES); }

  function porId(id) {
    var todos = lista();
    for (var i = 0; i < todos.length; i++) if (todos[i].id === id) return todos[i];
    return null;
  }

  function enSala(iSala) {
    var ns = FIJOS.filter(function (n) { return n.sala === iSala; });
    var v = visitanteActual();
    if (v && v.sala === iSala) ns.push(v);
    return ns;
  }

  function npcEn(tx, ty, iSala) {
    var ns = enSala(iSala);
    for (var i = 0; i < ns.length; i++) {
      if (ns[i].x === tx && ns[i].y === ty) return ns[i];
    }
    return null;
  }

  // caja envolvente para el orden de pintado de la sala
  function caja(npc) {
    var m = 0.34, cx = npc.x + 0.5, cy = npc.y + 0.5;
    return { x0: cx - m, y0: cy - m, z0: 0, x1: cx + m, y1: cy + m, z1: 1.7 };
  }

  // ---------------- dibujo ----------------

  function dibujar(ctx, npc, t) {
    var previo = Juego.aspecto();
    Avatar.ponAspecto(npc.aspecto);
    Avatar.dibujar(ctx, {
      x: npc.x + 0.5, y: npc.y + 0.5, dir: npc.dir || 0,
      pose: npc.baila ? "bailando" : "parado",
      fase: npc.baila ? t * 8 : 0, gz: 0
    });
    Avatar.ponAspecto(previo);

    // nombre flotante sobre la cabeza
    var etiqueta = npc.nombre + (npc.visita ? " · de visita" : "");
    var p = Iso.proyectar(npc.x + 0.5, npc.y + 0.5, 1.75);
    ctx.font = "bold 10px 'Trebuchet MS', 'Segoe UI', sans-serif";
    var w = ctx.measureText(etiqueta).width + 12;
    ctx.fillStyle = npc.visita ? "rgba(88, 60, 32, 0.78)" : "rgba(35, 37, 44, 0.72)";
    ctx.fillRect(p.x - w / 2, p.y - 15, w, 14);
    ctx.fillStyle = "#f2efe6";
    ctx.textAlign = "center";
    ctx.fillText(etiqueta, p.x, p.y - 4.5);
    ctx.textAlign = "left";
  }

  // ---------------- conversación ----------------

  function normalizar(s) {
    s = s.toLowerCase();
    if (s.normalize) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return s;
  }

  function alAzar(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function saludoDe(npc) { return alAzar(npc.saludos); }

  function responder(npc, texto) {
    var t = normalizar(texto);
    for (var i = 0; i < npc.temas.length; i++) {
      var tema = npc.temas[i];
      for (var j = 0; j < tema.claves.length; j++) {
        if (t.indexOf(tema.claves[j]) !== -1) return alAzar(tema.respuestas);
      }
    }
    var idx = (Math.random() * npc.genericas.length) | 0;
    if (npc.genericas.length > 1 && idx === ultimaGen[npc.id]) {
      idx = (idx + 1) % npc.genericas.length;
    }
    ultimaGen[npc.id] = idx;
    return npc.genericas[idx];
  }

  return {
    lista: lista,
    porId: porId,
    enSala: enSala,
    npcEn: npcEn,
    caja: caja,
    dibujar: dibujar,
    saludoDe: saludoDe,
    responder: responder,
    visitanteActual: visitanteActual,
    forzarVisita: forzarVisita
  };
})();
