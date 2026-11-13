# Correcciones que realmente nos hacen (análisis de casos reales)

Objetivo: calibrar el revisor de planos para que marque lo que el Colegio y el SCIT
efectivamente observan, y no cada punto de la norma que en la práctica se cumple
de otra forma. Los ejemplos están anonimizados (sin nombres de clientes).

## Fuentes analizadas

- **24 "previas" del Colegio** (`previa_ver_archivo*.pdf`, tal como se descargan del Colegio):
  21 de la carpeta de trabajos (2021–2026) + los 3 ejemplos de esta carpeta. Las observaciones
  vienen como comentarios de texto (anotaciones FreeText) más círculos y flechas sobre el plano.
  Total: unos **125 comentarios**.
- **8 "Solicitud de corrección de plano" al SCIT**: errores que se escaparon de la revisión
  y hubo que corregir con el plano ya registrado.
- 1 observación del SCIT a un croquis de certificado catastral.

Método: se extrajeron las anotaciones de cada PDF con PyMuPDF y el texto del plano que queda
debajo de cada círculo o flecha. Los conteos de abajo son aproximados (clasificación manual).

## Qué observa el Colegio, por tema

| # | Tema | ~Comentarios | Ejemplos (anonimizados) |
|---|------|--------------|-------------------------|
| 1 | **Titularidad y dominio frente a los títulos**: propietario, porcentajes, nuda propiedad / usufructo, herederos, marginales, fecha del dominio | 14 | "según títulos adjuntos, X adquiere 25%+12,5%. ¿Y el resto?"; "(nuda propiedad)?"; "usufructo?"; "hoy sus herederos??"; "dominio del 2023, ¿corresponde? verificar"; "verificar las marginales"; "de [apellido de casada]"; "verificar que ambos lotes tengan el mismo titular registral, sino no se puede unificar" |
| 2 | **Cierre y concordancia de medidas**: cierre angular, suma de ángulos o de superficies, medidas que deberían ser iguales, no coincide | 12 | "NO HAY CIERRE ANGULAR"; "VER ÁNGULOS"; "VER SUMA"; "DEBERÍAN SER IGUALES"; "NO COINCIDE. VER"; "controlar medidas con reglamentación (hipotenusa o catetos)"; "medidas totales?" |
| 3 | **Superficies y balance**: superficie en blanco, diferencia contra el antecedente o el título, sobrante, ochava | 11 | "sobrante? seguro? hacer una memoria que lo justifique"; "justificar diferencia con antecedente"; "superficie=......?"; "libre de ochava" (varias veces); "los títulos citan las superficies?" |
| 4 | **Linderos, arranques y ubicación** frente al título / plano antecedente | 10 | "faltan linderos según título"; "arranque?"; "verificar descripción, ver arranque indicado con mensura"; "controlar línea municipal con mensura, ¿están en la misma alineación?" |
| 5 | **Calles**: ancho oficial, nombre, dibujo de la calle | 7 | "ancho de calles?"; "¿y el ancho oficial?"; "muro y alambrado? acotar ambos"; "separar más la calle, pareciera que linda por el vértice" |
| 6 | **Datos en blanco o sin completar** (restos de plantilla) | 6 | "plano N°...... año"; "N° ___, fecha"; "CALLE......"; "LOTE..... DEL PLANO......" |
| 7 | **Elementos que faltan en el dibujo** | 10 | "FALTA TRAMADO" (2 veces); "faltan acotar anchos de muros en ambas plantas"; "falta columna fuera de los límites, ¿volado sobre vereda?"; "falta indicar bienes comunes de uso exclusivo"; "¿puertas? ¿ventanas? ¿escalera?" |
| 8 | **Presentación leve**: grosores de línea, altura de letras | 6 | "ver grosor"; "controlar grosores de líneas"; "la mensura debe ir en 0,6 mm"; "mayor altura de letras" |
| 9 | **Ocupación / materialización / tipo de mensura** | 6 | "s/mat?"; "¿es ocupación? ver circular 03/21"; "¿modificación? ¿unificación?"; "zona suburbana" |
| 10 | **Documentación a adjuntar** | 3 | "adjuntar título de propiedad"; "adjuntar documentación que lo avale" |
| 11 | **Marcas sueltas sobre un texto** (puntuación, letras, un número): típicamente errores de tipeo o rótulos | ~15 | "punto", ",", "X", "Y", "INVERTIDO", "MU?", "f)?", "1527", "¿ÁNGULO?" |
| — | **Estado del trámite** (no es del plano): "solicitud / sellado / FAC / libro digital / completar para final", "foja OK", "final observada" | ~18 | El revisor **no** debe tratarlos como errores del plano |

## Lo que casi nunca marca el Colegio

En los ~125 comentarios no aparece **nada** sobre: formato y plegado de la lámina, escalas
normalizadas, norte, designación de lotes con guion, tolerancias, mojones, croquis de
ubicación, fecha de levantamiento, firma o sello. Tampoco la altura de letra de la carátula,
salvo una vez. Son puntos de la norma que hoy el revisor evalúa siempre y que generan ruido.

## Errores que se escaparon y hubo que corregir con el plano registrado

Los 8 casos son del mismo tipo: **un dato mal copiado**, que se habría detectado
contrastando el plano con la escritura o el informe catastral.

- Nombre de calle distinto al real (una letra cambiada).
- Segundo nombre del propietario equivocado.
- Superficie de un lote mal tipeada (dígitos cambiados).
- Arranque mal tipeado (otro valor).
- Número de la dirección con dígitos cambiados (2 casos).
- Lindero indicado como "pasillo" cuando correspondía el dato de la PH del antecedente.
- Observaciones del SCIT a un croquis: "debe mencionar las medidas lineales", "verificar orientación", "error de tipeo en fecha".

## Conclusión para el revisor

1. Priorizar **concordancia** (el mismo dato igual en todos lados), **completitud** (que estén todos los
   elementos) y **tipeo** (nombres, números, ortografía), que es lo que se observa y lo que se escapa.
2. Bajar de prioridad o sacar los puntos de forma/formato que el Colegio no observa.
3. Los controles que más rebotan (titularidad, superficie del título, arranques, linderos) necesitan
   **los documentos de origen** (escritura o título, informe catastral, plano antecedente). Con solo
   el plano se puede ver la coherencia interna, pero no si un dato está mal copiado del título.
4. Ignorar los comentarios de estado del trámite.
