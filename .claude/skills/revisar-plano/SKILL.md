---
name: revisar-plano
description: Revisa un plano de mensura en PDF buscando errores de concordancia, elementos faltantes y errores de tipeo, y lo contrasta con la escritura y el set de datos (Informe Catastral) si se pasan. Usar cuando el usuario pida revisar un plano de mensura o pase la ruta de un plano, pida revisar un FAC (Formulario de Actualización de Construcciones), o pida las calles o la ubicación de una partida o parcela.
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
escaneada no tiene texto: se lee mirando sus imágenes. Si hay un FAC, extraelo aparte (como primer archivo y en otra
subcarpeta) para tener también sus recortes.

## 2. Leer todo antes de opinar

- Del **plano**: leé el texto y los bloques para tener los datos exactos (nombres, números, medidas) y mirá la imagen
  completa y los seis recortes para ver el dibujo (cotas, tramados, rótulos, qué lado es cada uno).
- De la **escritura** y del **set de datos**: leelos completos (las imágenes de cada página si es un escaneo).
- Transcribí los datos tal cual aparecen antes de compararlos. No des por buena una cuenta sin hacerla.

### Calles y norte

En un REP u otra mensura está el set de datos, que ya trae esa información: compará las calles (nombre y de qué lado
quedan) y el norte con sus croquis (miralos en las imágenes) y **no consultes IDESF**.

En un VEP no se descarga el set de datos: ahí ubicá la parcela en IDESF con la nomenclatura del folio o con la partida
(hacé lo mismo en otro plano solo si falta el set o el usuario lo pide):

```
python -I -X utf8 .claude/skills/revisar-plano/ubicar.py <carpeta_temporal> <folio.pdf | "10 11 03 0018 00065" | partida de 16 dígitos>
```

Con la partida consulta primero el SCIT y muestra la ubicación, la superficie y la parcela con su plano antecedente
(número, año, manzana y lote). Si el usuario solo pide las calles o la ubicación de una partida, corré esto y
respondé con las calles de cada lado (miralas en las imágenes), sin hacer el resto de la revisión.

Al servidor de la provincia solo se le envía la nomenclatura o la partida (después, las coordenadas que él mismo
devuelve). Genera
`croquis.png` (parcelas y calles con el norte hacia arriba, la parcela en rojo) y `calles.png` (zona más amplia, con
todos los nombres), y muestra el azimut de cada lado de la parcela. Miralos y compará:

- **Calles:** nombre de cada una, de qué lado de la parcela queda y la numeración contra la ubicación del plano. Una
  calle que falta, cambiada de lado o con otro nombre es un hallazgo. Las capas pueden abreviar o escribir distinto
  ("MONS ZASPE" / "VICENTE ZASPE"): eso no es tipeo. En un VEP vale el nombre del antecedente, con o sin "(HOY …)".
- **Norte:** tomá un lado largo del plano (identificalo por su medida) y medí su ángulo respecto del norte dibujado,
  con el mismo criterio del azimut (desde el norte hacia el este, 0 a 180°). Para medirlo usá las líneas del PDF
  (`page.get_drawings()` de pymupdf) o la imagen. Los azimuts son aproximados: marcá el norte solo si la diferencia
  pasa los 10°, y decí los dos valores.

Si una calle sale solo con la numeración, no le inventes el nombre: la ubicación que da el SCIT suele nombrar la del
frente; las demás quedan para confirmar con el antecedente.

El mapa no da anchos de calle. En parcelas rurales o muy grandes puede no dibujar la parcela (el rectángulo rojo es
solo su envolvente) y no hay azimuts. Si IDESF no responde, seguí la revisión y avisalo al final. Decile al usuario la
ruta de `croquis.png`.

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

**Nombres de calle:** vale la grafía del SCIT (cartografía, folio o set de datos). No marques como tipeo un nombre que
puede venir de ahí aunque la persona homenajeada se escriba distinto (ej. "ZASPE" en Santa Fe es correcto); si no lo
podés comprobar, preguntalo en vez de darlo por error.

**Norte:** todo plano, también un VEP, tiene que tener el norte indicado en el dibujo. Miralo en la imagen (no sale en
el texto); si no está, es un faltante.

**Cotas de muros:** revisalas una por una, en cada vértice, quiebre y tramo de lindero, ampliando la imagen (en los
recortes chicos no se distinguen). Las cotas parciales a cada lado de la línea tienen que sumar el espesor del muro
(ej. 0,07 + 0,08 = 0,15; 0,09 + 0,21 = 0,30). Hacé la cuenta en cada grupo: una parcial que no suma, o mayor que el
muro (un 0,80 en un muro de 0,15), es un hallazgo. El Colegio ya observó una así ("verificar medida acotada").

**Datos judiciales en observaciones:** si el plano cita un sucesorio u otro expediente judicial (carátula, CUIJ,
juzgado, nominación, herederos), buscá la declaratoria en la carpeta o en los argumentos (suele ser un escaneo:
extraela y leela mirando la imagen) y compará el CUIJ dígito por dígito, y el resto textual. Un dígito distinto es un
hallazgo (el Colegio observó "verificar numero de CUIJ"). Si el documento no está, no lo des por error: avisá al
final que no se pudo comprobar.

### Si el plano es un VEP (Verificación de Estado Parcelario)

Un VEP mantiene las medidas, los ángulos y la superficie del plano antecedente. Si en la carpeta o en los argumentos
está el plano antecedente (suele ser un escaneo: leelo mirando la imagen), extraelo también y comparalo con el VEP.
Las diferencias que vienen del antecedente (suma de lados contra superficie, ángulos redondeados, anchos de calle)
están dentro de tolerancia y NO se marcan. Sí se marca: que el cierre angular dé exacto, que el VEP no difiera del
antecedente sin justificar, las cuentas del estado de ocupación (superficies ocupadas contra las cotas del
alambrado), el tramado de lo ocupado, el rumbo de cada lindero (este/oeste, norte/sur), tipeo y concordancia con el
folio o set de datos. Cada invasión tiene que estar señalada en el dibujo con una flecha y su leyenda,
"SUP. OCUPADA A LINDERO ESTE" (la parcela ocupa al lindero) o "SUP. OCUPADA POR LINDERO ESTE" (el lindero ocupa la
parcela), con el rumbo que corresponda y coherente con el cuadro de ocupación; si falta, es un faltante. En un VEP no se pide acotar el ancho de las calles: no lo marques como faltante. Los linderos y las calles se respetan como están escritos en el antecedente: no marques que un
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

### FAC (Formulario de Actualización de Construcciones)

Si en la carpeta o en los argumentos hay un FAC (suele llamarse `…-FAC.pdf`: croquis de bloques, foto de fachada y
planilla de superficie de las mejoras), revisalo junto con el plano, o solo si es lo único que piden.

- **Datos:** lote, manzana y plano; partida; propietario y porcentaje contra el folio o el título; ubicación y número
  contra el folio y la chapa de la foto; lugar y fecha.
- **Sumas, rehechas todas:** la superficie de cada bloque a partir de sus medidas (cubierta, semicubierta en la columna
  S/CUBIERTA, que puede incluir voladizos, y pileta); si el polígono es irregular, calculala con las líneas del PDF
  (`page.get_drawings()` de pymupdf). Cada fila tiene que estar rotulada con el bloque del croquis. Después los
  subtotales por columna, el total existente, la superficie empadronada (la suma de las mejoras del folio) y la
  diferencia con su sentido (en más o en menos). La planilla redondea al m²: el redondeo no se marca.
- **Croquis:** las medidas de cada bloque tienen que cerrar entre sí y con las de la parcela.
- **Contra el plano:** las mismas construcciones (retiros, entrantes, voladizos), las mismas medidas y el norte girado
  igual (medilo en los dos). Si una diferencia cambia una superficie redondeada, mostrá cómo quedarían las cuentas.
- **Foto de fachada:** que esté, que sea de ese inmueble y que se vea bien en el PDF (colores degradados o manchas es un
  hallazgo de presentación; compará con la foto original si está en la carpeta).
- No tenemos la norma del FAC: no exijas campos que no sepas que son obligatorios (el "Nro." en blanco no se marca) y
  decilo al final.

## 4. Responder

En español rioplatense, en este orden:
1. **Resumen** de 1 o 2 frases con el estado general del plano.
2. **Contrastado con:** escritura, set de datos, o "solo el plano".
3. **Hallazgos**, numerados: `[tema · confianza] dónde está` y debajo qué está mal y por qué, con los números de la
   cuenta y, si es contra un documento, lo que dice cada uno, textual. Temas: concordancia, faltante, tipeo, presentación,
   contra la escritura / set, verificar contra el título.
4. Si algo no se pudo leer o falta un documento para comprobar un dato, decilo al final.

Con un FAC, antes de los hallazgos poné una tabla con cada suma: control, cuenta y lo que dice el FAC. Indicá en cada
hallazgo si es del plano o del FAC.

## 5. PDF con las observaciones en rojo

Después de responder, generá el PDF marcado como el del Colegio (solo si el plano tiene texto). Escribí un JSON en la
carpeta temporal con un objeto por hallazgo, `{"n": 1, "buscar": ["texto tal cual está en el plano"], "nota": "..."}`
(en `buscar` poné fragmentos cortos de una sola línea del plano, tal cual), y ejecutá:

```
python -I -X utf8 .claude/skills/revisar-plano/marcar.py <plano.pdf> <carpeta_temporal>/<nombre>_marcado.pdf <observaciones.json>
```

Encierra en rojo cada dato con el número del hallazgo y agrega una hoja con las observaciones. Si hay varios planos
(varios lotes) o un FAC, un PDF por documento con sus propios hallazgos. Decile al usuario la ruta completa del PDF; no lo copies a
la carpeta del cliente sin que lo pida. Si algún texto no se ubicó, avisalo.

No modifiques ningún archivo del proyecto al revisar. No copies datos de clientes fuera de esta conversación (la única
consulta externa es la de `ubicar.py` a la provincia, con la nomenclatura o la partida).
