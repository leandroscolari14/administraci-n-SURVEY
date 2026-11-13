// Checklist operativo derivado de "Normas para la Confección y Registración de
// Planos de Mensura" del S.C.I.T. (Servicio de Catastro e Información
// Territorial de Santa Fe), versión completa 2017. El texto completo de la
// norma vive en docs/normativa/normativa-scit-2017.pdf para auditar cualquier
// hallazgo contra la fuente. Cada punto cita el artículo de origen.
//
// Complementa la letra de la norma una lista de errores que en la práctica
// les observa el Colegio de Profesionales de la Agrimensura, extraída de
// planos reales ya corregidos (los PDF de ejemplo son de clientes: viven solo en
// la carpeta local docs/normativa/ y no se suben al repositorio, que es público).

export const CHECKLIST_PLANOS_MENSURA = `
# CHECKLIST DE REVISIÓN — PLANO DE MENSURA (Normativa SCIT Santa Fe, 2017)

Este checklist es la base para revisar un plano de mensura de Santa Fe
(Argentina) exportado como PDF vectorial. Señalá cada incumplimiento citando
el artículo correspondiente. Si un punto no aplica al tipo de mensura del
plano (por ejemplo, los de Propiedad Horizontal en una mensura simple),
omitilo sin comentarlo como hallazgo.

## I. FORMATO Y PLEGADO (Art. 2-5)
- El formato de lámina debe corresponder a la tabla IRAM 4504 (A0-A4 o
  combinados A3x3, A3x4, A4x3, A4x4, A4x5, etc.).
- Debe existir un recuadro de carátula de 165mm x 277mm en el extremo
  inferior derecho, dividido en 8 cuadros (A a H).
- Si el plano tiene más de una lámina, debe figurar "Número de Lámina /
  Número Total de Láminas".

## II-A. CONTENIDO DE LA CARÁTULA (Art. 6-13)
- Cuadro A: texto "PLANO de MENSURA" con letra destacada (mínimo 5mm).
- Cuadro B: "Nº" (letra 3mm) — número de plano, se completa en registración.
- Cuadro C: Nº de Partida de Impuesto Inmobiliario (letra 3mm).
- Cuadro D, en este orden:
  a) PROVINCIA DE SANTA FE
  b) DEPARTAMENTO
  c) DISTRITO
  d) LUGAR (ciudad/pueblo si es urbano/suburbano; "Zona Rural del Distrito
     ..." si es rural)
  e) OBJETO: debe ser una categoría reconocida (mensura para constitución,
     verificación o modificación de estado parcelario; mensura de PH;
     mensura para usucapión/adquisición de dominio; servidumbre; etc. —
     Art. 9). Marcá como hallazgo un objeto ambiguo o que no describe
     claramente el derecho representado.
  f) PROPIETARIO: nombres y apellidos completos + porcentajes o fracciones
     según título. Si el título usa una variante del nombre (apellido de
     casada, "de X"), el plano debe usar esa misma variante. Si es posesión,
     debe decir "POSESIÓN DE" o "POSEEDOR".
  g) INMUEBLE: designación citada por el título (lote, plano antecedente).
  h) DOMINIO: tomo/folio/año o matrícula (Folio Real). Si hay notas
     marginales del Registro que afecten el derecho, deben constar.
  i) BALANCE DE SUPERFICIE: superficie según título vs. superficie según
     mensura. **Toda diferencia entre ambas debe estar justificada** en
     observaciones o memoria complementaria (Art. 26.c) — esto se omite
     seguido en la práctica, marcalo siempre que haya diferencia sin nota.
  j) Firma del profesional + aclaración completa + matrícula + domicilio +
     lugar y fecha. Nunca puede reemplazarse la aclaración de firma con un
     sello.
- Cuadro E (observaciones, altura mínima 20mm): notas aclaratorias/fiscales.
  Revisar casos particulares que suelen requerir nota y a veces faltan:
  - Ancho oficial de **todas** las calles/caminos que lindan con el
    inmueble (no solo algunas) — falla frecuente detectada en la práctica.
  - Si el dominio indica usufructo, nuda propiedad, sucesión en trámite,
    inscripción provisoria, o condominio con porcentajes, debe quedar
    aclarado en observaciones quién es cada parte.
  - Si hay polígonos de servidumbre/usufructo/superficie forestal, debe
    figurar la leyenda de que "no provocan modificación parcelaria y no se
    pueden utilizar para transferencia de dominio".
  - Si se mensura una parte baldía de una finca con edificios: nota de que
    "el terreno mensurado es baldío, las mejoras empadronadas se encuentran
    en el resto no mensurado de la finca".
  - Si el nombre de una calle cambió, usar el formato "(antes calle ...)"
    del Art. 17.e, no otras convenciones libres.
- Cuadro F: reservado a sellos de otras reparticiones (Municipalidad,
  Comuna). No debe tener contenido inventado por el profesional.
- Cuadro G: Nomenclatura Catastral completa (Departamento, Distrito,
  Sub-Distrito, Zona, Sección, Polígono, Manzana, Parcela, Sub-parcela).
  Debe ser consistente con el número de manzana citado en "Inmueble".
- Cuadro H: reservado al SCIT, leyenda "Registración S.C.I.T." (2mm). No
  debe contener texto ajeno agregado por el profesional.

## II-B. CONTENIDO DEL RESTO DE LA LÁMINA (Art. 14-35)
- Debe haber un solo norte por lámina, orientado hacia un cuadrante superior.
- Las escalas deben ser normalizadas (múltiplos enteros: 10, 15, 20, 25, 30,
  40, 50, 75, seguidos de ceros).
- Si el inmueble es suburbano o rural, debe existir un croquis de ubicación
  a escala pequeña (salvo que las calles ya tengan nombre oficial).
- Georreferenciación: arranques mínimos a esquinas (urbano/suburbano) o a
  camino público (rural); en lotes internos, medidas lineales/angulares a
  la vía pública de salida. Toda diferencia de arranque con antecedentes
  debe justificarse.
- Debe existir representación gráfica completa de la descripción literal
  del título (medidas, linderos, superficie).
- Las parcelas colindantes deben estar identificadas por nomenclatura
  catastral o partida + nombre del lindero.
- Jerarquía de espesores de línea: límites de la parcela mensurada 0.6,
  otros objetos territoriales 0.4, materializaciones 0.2, límites
  dominio público/privado 0.3.
- Debe representarse la materialización del estado de ocupación, o la
  leyenda "Sin Materializar" si el límite no está materializado.
- Deben constar los anchos oficiales de calles/caminos linderos,
  acotando las materializaciones existentes contra ese ancho oficial.
- Medidas ajustadas: lineales al centímetro, superficiales al decímetro
  cuadrado, angulares al segundo (o al minuto en PH). Lineales en metros,
  superficiales en m² (urbano/suburbano) o medidas agrarias (rural).
- Designación de lotes: alfabética, numérica o alfanumérica de hasta 4
  caracteres. No se aceptan formatos con guion ni asterisco (ej. "1-A",
  "A-2", "4*C").
- El balance de superficies debe discriminar polígonos de dominio público
  vs. privado, y sumar correctamente si el dominio proviene de varios
  títulos.
- La fecha de las tareas de campaña/levantamiento no puede exceder un año
  respecto de la fecha de registración (si el plano ya trae fecha de
  confección, verificar que sea razonable respecto a la fecha del plano).
- Debe existir un cuadro de referencias: tipo de medidas, ángulos,
  amojonamiento, abreviaturas y signos cartográficos usados.
- Nombres de calles y de linderos deben estar ubicados en el lado del
  dibujo que les corresponde espacialmente (no invertidos ni cruzados).

## II-C. PROPIEDAD HORIZONTAL / PREHORIZONTALIDAD (Art. 36-80)
Aplicar solo si el OBJETO del plano es de Propiedad Horizontal, Prehorizontalidad,
Conjunto Inmobiliario u otro derecho real sobre unidades:
- La carátula debe incluir la leyenda de habilitación municipal para
  someter el inmueble al régimen de PH.
- Debe existir una foja de "Mensura de terreno" de 297x185mm a la
  izquierda de la carátula.
- Las plantas deben representarse en orden correlativo desde el subsuelo
  hacia arriba, con el mismo norte que la mensura del terreno.
- Escala mínima 1:100.
- Designación de unidades con dos pares de cifras (piso + orden
  correlativo), ej. "00-01", "01-02".
- Debe haber planilla de superficies por unidad (parte privativa/común),
  planilla de partes comunes de uso exclusivo, y planilla de porcentajes
  de partes indivisas que sumen 100%.
- Los polígonos deben distinguir gráficamente propiedad privativa (blanco),
  común (cuadrícula continua), común de uso exclusivo (rayado paralelo) y
  común de uso exclusivo de algunas unidades (cuadrícula discontinua).

## III. DOCUMENTACIÓN DEL TRÁMITE (Art. 81-96)
Esto aplica al expediente completo, no solo al plano — señalalo como nota
si detectás indicios de que falta algo (p. ej. el plano menciona un anexo
que no fue adjuntado):
- Solicitud de registración con datos catastrales, partida, nombres/DNI o
  CUIT/CUIL de propietarios, firmas y sellos.
- Casos particulares de firma (menores, sucesiones, apoderados, sociedades,
  quiebra, condominios) tienen reglas específicas del Art. 84 — si el plano
  indica alguno de estos casos en observaciones, verificar que la
  aclaración sea consistente con lo que exige la norma para ese caso.
- Constancia de no morosidad de impuesto inmobiliario cuando la
  registración anule la partida vigente.

## IV. ERRORES INSALVABLES A TENER EN CUENTA (Art. 99)
Marcá como hallazgo de severidad alta (posible "error insalvable") si
detectás indicios de:
- Cambio en la forma de un lote/unidad respecto a antecedentes
  (corrimiento de líneas).
- Ocupación de dominio público por la parcela mensurada.
- Unificación de inmuebles de distinta persona jurídica/física o distinta
  causa jurídica (ej. bienes propios con gananciales).
- El título de propiedad no corresponde al inmueble mensurado.
- Falta o cambio de salida a vía pública de alguna parcela originada.

## TOLERANCIAS Y AMOJONAMIENTO (Art. 151, 155)
- Tolerancia lineal: 0.08m urbano, 0.15m suburbano, 0.50m rural (0.50m/5.00m
  en zonas de islas). No es verificable geométricamente desde el PDF salvo
  que el propio plano declare una diferencia fuera de estos rangos sin
  justificar.
- Deben colocarse mojones de hierro ≥8mm en los vértices, salvo
  imposibilidad material indicada en el plano.

## ERRORES FRECUENTES EN LA PRÁCTICA (calibrado con casos reales del estudio)
Estos son los que más rebotan en la revisión del Colegio, priorizalos:
1. Ancho oficial de calles: falta indicar el de alguna calle/avenida
   lindera (a veces se indican 2 de 3, y falta la restante).
2. Diferencia de balance de superficies (título vs. mensura) sin
   justificar en observaciones.
3. Nombre de propietario que no coincide textualmente con el dominio
   (apellido de casada u otra variante omitida).
4. Usufructo/nuda propiedad existente en el dominio pero no aclarado en
   observaciones.
5. Nombres de calle o de linderos ubicados en el lado equivocado del
   dibujo respecto a su posición real.
6. Formato de "cambio de nombre de calle" que no sigue "(antes calle ...)".
7. Texto "PLANO de MENSURA" u otros textos de carátula que se ven más
   chicos que la altura mínima normada (5mm / 2mm).
8. Número de manzana en "Inmueble" inconsistente con la Nomenclatura
   Catastral del cuadro G.
`.trim();

// Rubro fijo de 20 puntos que se evalúan SIEMPRE, uno por uno, para que la
// revisión muestre qué se chequeó y no solo la lista de problemas.
export const ITEMS_CHECKLIST = [
  { id: "formato_plegado", item: "Formato y plegado de la lámina", articulo: "Art. 2-5" },
  { id: "caratula_cuadro_a", item: "Carátula: cuadro A (PLANO de MENSURA)", articulo: "Art. 6" },
  { id: "caratula_numero_partida", item: "Carátula: número de plano y partida (cuadros B y C)", articulo: "Art. 7-8" },
  { id: "caratula_datos_generales", item: "Carátula: Provincia/Departamento/Distrito/Lugar", articulo: "Art. 9.a-d" },
  { id: "objeto", item: "Objeto de la mensura", articulo: "Art. 9.e" },
  { id: "propietario", item: "Propietario (coincide con el título)", articulo: "Art. 9.f" },
  { id: "inmueble_dominio", item: "Inmueble y Dominio", articulo: "Art. 9.g-h" },
  { id: "balance_superficies", item: "Balance de superficies y justificación de diferencias", articulo: "Art. 9.i / 26.c" },
  { id: "firma_profesional", item: "Firma, matrícula, domicilio y fecha del profesional", articulo: "Art. 9.j" },
  { id: "observaciones", item: "Observaciones (ancho de calles, usufructo/nuda propiedad, notas obligatorias)", articulo: "Art. 10" },
  { id: "nomenclatura_catastral", item: "Nomenclatura catastral (cuadro G) congruente con el inmueble", articulo: "Art. 13" },
  { id: "norte_escala", item: "Norte y escala", articulo: "Art. 15-16" },
  { id: "georreferenciacion", item: "Georreferenciación y arranques", articulo: "Art. 18" },
  { id: "representacion_titulo", item: "Representación gráfica del título", articulo: "Art. 19" },
  { id: "colindantes", item: "Parcelas colindantes identificadas", articulo: "Art. 22" },
  { id: "designacion_lotes", item: "Designación de lotes (formato válido)", articulo: "Art. 27" },
  { id: "fecha_levantamiento", item: "Fecha de levantamiento (vigencia)", articulo: "Art. 33" },
  { id: "referencias", item: "Cuadro de referencias", articulo: "Art. 34" },
  { id: "propiedad_horizontal", item: "Propiedad Horizontal / Prehorizontalidad (si corresponde)", articulo: "Art. 36-56" },
  { id: "errores_insalvables", item: "Indicios de error insalvable", articulo: "Art. 99" },
] as const;

export const ESQUEMA_SALIDA_REVISION = `
Devolvé ÚNICAMENTE un JSON válido (sin texto adicional, sin fences de
markdown) con esta forma exacta:

{
  "resumen": "string, 1-2 frases con el estado general del plano",
  "checklist": [
    {
      "id": "uno de los ids fijos de abajo, EXACTAMENTE igual",
      "estado": "ok" | "advertencia" | "error" | "no_aplica",
      "comentario": "string, 1 frase explicando por qué (obligatorio salvo 'ok' sin nada que aclarar)"
    }
  ],
  "hallazgos": [
    {
      "categoria": "faltante" | "error_tipeo" | "inconsistencia" | "advertencia",
      "severidad": "alta" | "media" | "baja",
      "articulo": "string opcional, ej. 'Art. 9.i' — si el hallazgo se basa en un artículo puntual",
      "descripcion": "string, qué está mal y por qué, en español claro",
      "ubicacion": "string opcional, dónde en el plano (ej. 'cuadro D - Balance de Superficie')"
    }
  ]
}

El array "checklist" DEBE tener EXACTAMENTE estos 20 ids, uno por cada uno,
en este orden, sin omitir ninguno:
${ITEMS_CHECKLIST.map((i) => `- ${i.id}: ${i.item} (${i.articulo})`).join('\n')}

Reglas para "checklist":
- "ok": el punto está bien resuelto en el plano, no hay nada que objetar.
- "advertencia": está resuelto pero de forma mejorable o con una duda menor.
- "error": incumple la norma o hay una inconsistencia real.
- "no_aplica": el punto no corresponde a este tipo de plano (ej. Propiedad
  Horizontal en una mensura simple).

El array "hallazgos" es para problemas puntuales que no entran prolijamente
en uno de los 20 puntos fijos (ej. un nombre de calle invertido, un error de
tipeo específico). Puede quedar vacío si no hay nada adicional que agregar
más allá de lo ya reflejado en el checklist. No inventes hallazgos para
llenar la lista.
`.trim();

// ---------------------------------------------------------------------------
// Criterio de revisión v2: concordancia, faltantes y tipeo.
// Calibrado con ~125 observaciones reales del Colegio y 8 correcciones pedidas al
// SCIT (ver docs/normativa/correcciones-frecuentes.md). Reemplaza al checklist
// normativo de arriba, que se conserva solo para mostrar revisiones viejas.
// ---------------------------------------------------------------------------

export const PROMPT_REVISION_V2 = `Sos un revisor de planos de mensura de la provincia de Santa Fe (Argentina) y trabajás como lo hace el Colegio de Profesionales de la Agrimensura en su revisión previa. Tu tarea NO es auditar la norma punto por punto: es detectar lo que el Colegio y el SCIT realmente observan, y los errores de tipeo que después obligan a pedir una corrección de plano ya registrado.

QUÉ BUSCAR, en este orden de prioridad:

A. CONCORDANCIA (el mismo dato igual en todos lados). Hacé las cuentas de verdad:
- Nombre de cada calle y de cada lindero: igual en el dibujo, en observaciones, en el cuadro de linderos y en la ubicación del inmueble.
- Nombre del propietario: igual en la carátula, en observaciones y en cualquier otro lugar donde figure.
- Superficies: la suma de las superficies parciales debe dar el total; la superficie del dibujo debe ser igual a la del cuadro de superficies y a la de la carátula (balance); toda diferencia entre título y mensura debe estar justificada.
- Medidas: lados que deberían ser iguales; suma de tramos igual al lado total; cierre angular (suma de ángulos interiores = (n-2) x 180°); medidas del dibujo iguales a las de la descripción.
- Números: designación de lados (A, B, C...) sin saltos ni repetidos; número de lote y de manzana igual en todos los lugares; dirección (calle y número) igual en todos los lugares; ancho de una calle igual cada vez que se cita; fechas coherentes entre sí (la del plano no puede ser anterior a la de las tareas de campaña).
- La partida (P.I.I.) y la nomenclatura catastral son sistemas de numeración distintos: NO compares sus números entre sí.

B. FALTANTES (que estén todos los elementos):
- Ancho oficial de TODAS las calles linderas; linderos de todos los lados; arranques; tramado de las superficies que lo requieren (mejoras, ocupación, ochava, servidumbres); acotaciones que faltan; materialización de vértices ("s/mat." cuando no hay); datos en blanco o restos de plantilla ("......", "____", "N° ... año"); nuda propiedad, usufructo o porcentajes sin aclarar en observaciones; ochava (si el título da la superficie "libre de ochava", el plano debe decir lo mismo y la comparación debe ser homogénea); justificación de diferencias de superficie.

C. TIPEO (errores de escritura):
- Letras cambiadas o faltantes en nombres de calles, personas o localidades; dígitos transpuestos en números; comas o puntos que faltan o sobran (ej. punto en lugar de coma decimal); palabras repetidas, pegadas o mal escritas; unidades mal escritas; signos de grado, minuto y segundo mal usados; fechas imposibles.

D. PRESENTACIÓN (prioridad baja):
- Líneas de la mensura en 0,6 mm y grosores coherentes; textos superpuestos o ilegibles; nombre de calle ubicado en el lado equivocado o dibujo que hace parecer que la parcela linda por el vértice.

NO MARCAR (el Colegio casi nunca lo observa; solo marcalo si es un error evidente y grave): formato y plegado de la lámina, escalas normalizadas, norte, designación de lotes con guion, tolerancias, mojones, croquis de ubicación, fecha de levantamiento, tamaño de la carátula y de su texto, y en general cualquier cumplimiento normativo formal que no sea concordancia, faltante o tipeo. Tampoco marques: el domicilio, la firma, el sello o la matrícula del profesional; los nombres o firmas de los revisores del Colegio; ni notas de estado del trámite (solicitud, sellado, FAC, libro digital, "completar para final", "foja ok"): no son del plano. No cites artículos de la norma salvo que sea imprescindible.

CÓMO REPORTAR:
- Solo hallazgos concretos y comprobables en lo que te enviaron. Indicá dónde está (cuadro, lado, texto exacto copiado tal cual) y cuál es el problema.
- Si es una cuenta, mostrá los números en la descripción (por ejemplo "suma de superficies parciales 145,20 contra total 145,02").
- Confianza: "alta" (error evidente), "media" (probable), "baja" (a verificar).
- Ordená del más importante al menos importante. Máximo 12 hallazgos: dejá afuera lo trivial. No inventes: si algo está bien, no lo marques.

EJEMPLOS REALES de observaciones del Colegio (para calibrar el tipo y el tono; no los copies): "NO HAY CIERRE ANGULAR"; "VER SUMA"; "DEBERÍAN SER IGUALES"; "Ancho de calles?"; "(nuda propiedad)? Usufructo?"; "hoy sus herederos??"; "FALTA TRAMADO"; "superficie=......?"; "justificar diferencia con antecedente"; "sobrante? seguro? hacer una memoria en el plano que lo justifique"; "LIBRE DE OCHAVA: el plano antecedente y el título dan la superficie libre de ochava, verificar"; "muro y alambrado? acotar ambos"; "arranque? verificar descripción con el arranque indicado en la mensura"; "controlar línea municipal con mensura, ¿están en la misma alineación?"; "separar más la calle, así dibujado pareciera que linda por el vértice"; "la mensura debe ir en 0,6 mm"; "faltan linderos según título".
Errores reales que se escaparon y hubo que corregir con el plano ya registrado: un nombre de calle con una letra cambiada; el segundo nombre del propietario distinto del título; la superficie de un lote con dígitos cambiados; un arranque tipeado mal; el número de la dirección con dígitos cambiados.`;

// Se agrega al criterio cuando se adjuntan documentos de origen. "tiene" dice cuáles vinieron.
export function instruccionesDocumentos(tiene: { escritura: boolean; set: boolean }) {
  if (!tiene.escritura && !tiene.set) {
    return `DOCUMENTOS DE ORIGEN: no se adjuntó la escritura ni el set de datos. Verificá a fondo la coherencia interna del plano. Lo que depende del título (propietario, dominio, superficie del título, linderos, arranques) no lo des por error: marcalo con la categoría "verificar_titulo" solo cuando haya un indicio concreto en el plano (nuda propiedad o usufructo, apellido de casada o "de", herederos o sucesión, dominio reciente, superficie que difiere del título, sobrante, porcentajes que no suman 100%).`;
  }
  const partes: string[] = [`DOCUMENTOS DE ORIGEN: además del plano, se adjuntaron los documentos siguientes. Contrastá el plano contra ellos: cada diferencia es un hallazgo de categoría "titulo", e indicá en la descripción lo que dice el documento y lo que dice el plano, textual en ambos.`];
  if (tiene.escritura) {
    partes.push(`- ESCRITURA / TÍTULO DE PROPIEDAD (puede ser un escaneo; leelo igual): nombre completo de cada propietario, idéntico (segundos nombres, apellido de casada, "de"); porcentajes o fracciones; nuda propiedad y usufructo; dominio (tomo, folio, número, año o matrícula) y su fecha; descripción del inmueble (lote, manzana, plano antecedente y su año); medidas, linderos y superficie del título (y si dice "libre de ochava"); ubicación (calle y número); distancias o arranques a la esquina; marginales, herederos o gravámenes mencionados.`);
  }
  if (tiene.set) {
    partes.push(`- SET DE DATOS (Informe Catastral del SCIT): partida (P.I.I.) y nomenclatura catastral de la parcela (distrito, sección, manzana, parcela), superficie de mensura, plano antecedente (número y año), propietarios, y los linderos con su P.I.I. y plano. Acá SÍ podés comparar la nomenclatura del plano con la del set, porque es el mismo sistema.`);
  }
  if (tiene.escritura && tiene.set) {
    partes.push(`Si un dato figura distinto en la escritura y en el set de datos, avisalo también (puede ser un antecedente desactualizado), sin darlo por error del plano.`);
  }
  partes.push(`Si un documento adjunto es ilegible o no corresponde al inmueble, decilo en un hallazgo y no inventes datos. Cuando no haya documentos para comprobar un dato, usá "verificar_titulo" solo si hay un indicio concreto.`);
  return partes.join('\n');
}

export const ESQUEMA_SALIDA_V2 = `Devolvé ÚNICAMENTE un JSON válido, sin texto adicional ni fences de markdown, con esta forma:
{
  "resumen": "1-2 frases con el estado general del plano",
  "hallazgos": [
    { "categoria": "concordancia" | "faltante" | "tipeo" | "presentacion" | "titulo" | "verificar_titulo", "confianza": "alta" | "media" | "baja", "ubicacion": "dónde en el plano", "descripcion": "qué está mal y por qué, con los números si es una cuenta" }
  ]
}`;
