"""Marca en rojo las observaciones sobre el PDF del plano (como la revisión del Colegio).

Uso: python -I -X utf8 marcar.py entrada.pdf salida.pdf observaciones.json
observaciones.json: [{"n":1,"buscar":["texto tal cual está en el plano", ...],"nota":"observación"}, ...]
  - "buscar": textos a encerrar en rojo (se buscan en la hoja 1; no distingue mayúsculas). Un hallazgo sin
    "buscar" o cuyo texto no se encuentra se lista igual en la hoja de observaciones y se avisa por pantalla.
  - Agrega al final una hoja con las observaciones numeradas.
Solo sirve con planos que tengan texto (no escaneos).
"""
import json, sys
import pymupdf as fitz

ROJO = (1, 0, 0)
entrada, salida, obs_path = sys.argv[1:4]
obs = json.load(open(obs_path, encoding="utf-8"))
doc = fitz.open(entrada)
pag = doc[0]
no_hallados = []
for o in obs:
    hallado = False
    for txt in o.get("buscar", []):
        for r in pag.search_for(txt):
            hallado = True
            rr = fitz.Rect(r.x0 - 2, r.y0 - 2, r.x1 + 2, r.y1 + 2)
            pag.draw_rect(rr, color=ROJO, width=1.2)
            # globito con el número, arriba a la derecha del recuadro
            c = fitz.Point(rr.x1 + 5, rr.y0 - 5)
            pag.draw_circle(c, 6, color=ROJO, fill=ROJO)
            pag.insert_text(fitz.Point(c.x - (2.2 if o["n"] < 10 else 4.4), c.y + 2.6), str(o["n"]),
                            fontsize=7.5, color=(1, 1, 1), fontname="hebo")
    if not hallado:
        no_hallados.append(o["n"])

# página de observaciones al final
w, h = pag.rect.width, pag.rect.height
lista = doc.new_page(width=w, height=h)
lista.insert_text(fitz.Point(40, 50), "OBSERVACIONES", fontsize=16, color=ROJO, fontname="hebo")
y = 80
for o in obs:
    caja = fitz.Rect(40, y, w - 40, y + 200)
    sobra = lista.insert_textbox(caja, f'{o["n"]}. {o["nota"]}', fontsize=10, color=ROJO)
    y += caja.height - sobra + 8   # alto que ocupó el texto, según el ancho de la hoja
doc.save(salida)
print("guardado", salida, "| sin ubicar en el dibujo:", no_hallados)
