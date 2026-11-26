---
name: revisar-plano
description: Revisa un plano de mensura en PDF buscando errores de concordancia, elementos faltantes y errores de tipeo, y lo contrasta con la escritura y el set de datos (Informe Catastral) si se pasan. Usar cuando el usuario pida revisar un plano de mensura o pase la ruta de un plano.
argument-hint: <plano.pdf> [escritura.pdf] [set-de-datos.pdf]
---

# Revisar un plano de mensura

Argumentos: `$ARGUMENTS` — rutas de PDF separadas por espacios (las que tengan espacios van entre comillas).
El primero es el **plano a revisar**. Los siguientes son opcionales: la **escritura** (o título) y el **set de datos**
(Informe Catastral del SCIT). Si no queda claro cuál es cuál, mirá el nombre y el contenido (el set de datos dice
"Informe Catastral" y trae la partida, la nomenclatura y los linderos con su P.I.I.). Si falta el plano, pedilo.

## 1. Preparar los archivos

Ejecutá el ayudante, que saca el texto con posiciones y las imágenes de cada hoja. Usá Python en modo aislado
(los PDF son de clientes) y una carpeta temporal de esta sesión (la del scratchpad):

```
python -I -X utf8 .claude/skills/revisar-plano/extraer.py <carpeta_temporal> <plano.pdf> [<escritura.pdf>] [<set.pdf>]
```

Genera, por cada PDF, `<nombre>.txt` (texto), `<nombre>_bloques.txt` (bloques con posición), `<nombre>_p1.png` (hoja
completa) y, en el plano, seis recortes ampliados `<nombre>_p1_c1..c6.png` para leer el texto chico. Una escritura
escaneada no tiene texto: se lee mirando sus imágenes.

## 2. Leer todo antes de opinar

- Del **plano**: leé el texto y los bloques para tener los datos exactos (nombres, números, medidas) y mirá la imagen
  completa y los seis recortes para ver el dibujo (cotas, tramados, rótulos, qué lado es cada uno).
- De la **escritura** y del **set de datos**: leelos completos (las imágenes de cada página si es un escaneo).
- Transcribí los datos tal cual aparecen antes de compararlos. No des por buena una cuenta sin hacerla.

## 3. Aplicar el criterio

El criterio de revisión está en `app/lib/normativaPlanos.ts`: leé `PROMPT_REVISION_V2` (qué buscar y qué no marcar) y
`instruccionesDocumentos` (cómo contrastar la escritura y el set). Aplicalos al pie de la letra. En resumen: concordancia
(el mismo dato igual en todos lados, con las cuentas hechas), faltantes, tipeo, y presentación como prioridad baja. No
compares la partida (P.I.I.) con la nomenclatura. No marques formato, escalas, firma, domicilio del profesional,
ni notas de estado del trámite. Máximo 12 hallazgos, del más al menos importante.

### Faltantes que el Colegio observa seguido

Revisá siempre: (1) ancho de cada calle acotado entre líneas municipales en el dibujo, incluso las
que se ven solo en el arranque o en una esquina (esto NO en los VEP); (2) espesor de muros acotado cuando el límite o las mejoras son muros;
(3) nombre del propietario completo tal cual figura en el título (ej. "ALCIDES OSCAR DEL POZO", no "ALCIDES DEL POZO");
(4) una línea de "superficie s/título" por cada fracción del título, identificada (punto A, punto B); (5) linderos
indicados en el croquis de integración de títulos; (6) respaldo de lo que se afirma en observaciones (declaratoria de
herederos, escritura adjunta o con su dato de inscripción).

**Norte:** todo plano, también un VEP, tiene que tener el norte indicado en el dibujo. Miralo en la imagen (no sale en
el texto); si no está, es un faltante.

### Si el plano es un VEP (Verificación de Estado Parcelario)

Un VEP mantiene las medidas, los ángulos y la superficie del plano antecedente. Si en la carpeta o en los argumentos
está el plano antecedente (suele ser un escaneo: leelo mirando la imagen), extraelo también y comparalo con el VEP.
Las diferencias que vienen del antecedente (suma de lados contra superficie, ángulos redondeados, anchos de calle)
están dentro de tolerancia y NO se marcan. Sí se marca: que el cierre angular dé exacto, que el VEP no difiera del
antecedente sin justificar, las cuentas del estado de ocupación (superficies ocupadas contra las cotas del
alambrado), el tramado de lo ocupado, el rumbo de cada lindero (este/oeste, norte/sur), tipeo y concordancia con el
folio o set de datos. En un VEP no se pide acotar el ancho de las calles: no lo marques como faltante. Los linderos y las calles se respetan como están escritos en el antecedente: no marques que un
nombre difiera de otros documentos si coincide con el antecedente, y en zona urbana una calle puede llevar su
actualización (por ejemplo "CALLE MARMOL (HOY AV. 7 DE MARZO)"), que es correcta. Si no hay antecedente, decilo al final.

### Si el plano es un REP u otra mensura (no VEP)

No se compara con el plano antecedente (ni medidas ni linderos): eso es solo para VEP. Se contrasta con la escritura
(medidas, superficie, linderos del título, dominio, propietario) y los linderos se comparan con el set de datos
(nombre, P.I.I. y plano de cada lindero). Si hay varios lotes bajo una misma partida, cada lote es un plano: revisalos
por separado y marcá a qué lote corresponde cada hallazgo.

El set de datos lista también a los linderos que tocan la parcela solo en un vértice; esos NO van en el plano. Que un
lindero del set falte en el plano no es un error si solo toca un vértice (mirá el croquis del set); sí lo es si
comparte un lado.

La fecha del dominio (y el resto de los datos de inscripción) vale la que figura en la escritura: el folio y el set
pueden estar mal. Si el plano coincide con la escritura, no lo marques aunque el set o el folio digan otra cosa.

## 4. Responder

En español rioplatense, en este orden:
1. **Resumen** de 1 o 2 frases con el estado general del plano.
2. **Contrastado con:** escritura, set de datos, o "solo el plano".
3. **Hallazgos**, numerados: `[tema · confianza] dónde está` y debajo qué está mal y por qué, con los números de la
   cuenta y, si es contra un documento, lo que dice cada uno, textual. Temas: concordancia, faltante, tipeo, presentación,
   contra la escritura / set, verificar contra el título.
4. Si algo no se pudo leer o falta un documento para comprobar un dato, decilo al final.

## 5. PDF con las observaciones en rojo

Después de responder, generá el PDF marcado como el del Colegio (solo si el plano tiene texto). Escribí un JSON en la
carpeta temporal con un objeto por hallazgo, `{"n": 1, "buscar": ["texto tal cual está en el plano"], "nota": "..."}`
(en `buscar` poné fragmentos cortos de una sola línea del plano, tal cual), y ejecutá:

```
python -I -X utf8 .claude/skills/revisar-plano/marcar.py <plano.pdf> <carpeta_temporal>/<nombre>_marcado.pdf <observaciones.json>
```

Encierra en rojo cada dato con el número del hallazgo y agrega una hoja con las observaciones. Si hay varios planos
(varios lotes), un PDF por plano con sus propios hallazgos. Decile al usuario la ruta completa del PDF; no lo copies a
la carpeta del cliente sin que lo pida. Si algún texto no se ubicó, avisalo.

No modifiques ningún archivo del proyecto al revisar. No copies datos de clientes fuera de esta conversación.
