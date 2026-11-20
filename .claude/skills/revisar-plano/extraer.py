"""Prepara PDFs para revisarlos: texto con posiciones e imágenes de cada hoja.

Uso:  python -I -X utf8 extraer.py <carpeta_salida> <pdf1> [<pdf2> ...]

Por cada PDF genera en la carpeta de salida:
  <nombre>.txt                texto de cada página (vacío si es un escaneo)
  <nombre>_bloques.txt        bloques de texto con su posición (x0,y0,x1,y1) para ubicar un dato en el dibujo
  <nombre>_p<N>.png           la página completa (para ver la composición)
  <nombre>_p<N>_c<1-6>.png    la página dividida en 6 recortes ampliados (para leer el texto chico)
Los escaneos (sin texto) solo generan las imágenes de página, hasta 8 páginas.
"""
import os
import re
import sys

try:
    import pymupdf as fitz
except ImportError:  # versiones viejas
    import fitz

MAX_PAGINAS_IMAGEN = 8
LADO_PAGINA = 1800   # px del lado mayor en la imagen de página completa
LADO_RECORTE = 1600  # px del lado mayor en cada recorte


def nombre_seguro(ruta):
    base = os.path.splitext(os.path.basename(ruta))[0]
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", base)[:50] or "documento"


def render(pagina, ancho_max, clip=None):
    rect = clip or pagina.rect
    escala = ancho_max / max(rect.width, rect.height)
    return pagina.get_pixmap(matrix=fitz.Matrix(escala, escala), clip=clip, alpha=False)


def procesar(ruta, salida):
    nombre = nombre_seguro(ruta)
    doc = fitz.open(ruta)
    texto_total = 0
    lineas_txt, lineas_bloques = [], []
    for i, pag in enumerate(doc, start=1):
        t = pag.get_text("text", sort=True)
        texto_total += len(t.strip())
        lineas_txt.append(f"===== Página {i} =====\n{t}")
        for b in pag.get_text("blocks", sort=True):
            if b[6] == 0 and b[4].strip():
                lineas_bloques.append(f"p{i} ({b[0]:.0f},{b[1]:.0f},{b[2]:.0f},{b[3]:.0f}) | " + " ".join(b[4].split()))
    with open(os.path.join(salida, nombre + ".txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lineas_txt))
    with open(os.path.join(salida, nombre + "_bloques.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lineas_bloques))

    escaneado = texto_total < 50 * doc.page_count
    imagenes = 0
    for i, pag in enumerate(doc, start=1):
        if i > MAX_PAGINAS_IMAGEN:
            break
        render(pag, LADO_PAGINA).save(os.path.join(salida, f"{nombre}_p{i}.png"))
        imagenes += 1
        if not escaneado:  # un plano: recortes ampliados (3 columnas x 2 filas) con un poco de solape
            r = pag.rect
            n = 0
            for fila in range(2):
                for col in range(3):
                    n += 1
                    ancho, alto = r.width / 3, r.height / 2
                    clip = fitz.Rect(r.x0 + col * ancho - 10, r.y0 + fila * alto - 10, r.x0 + (col + 1) * ancho + 10, r.y0 + (fila + 1) * alto + 10) & r
                    render(pag, LADO_RECORTE, clip).save(os.path.join(salida, f"{nombre}_p{i}_c{n}.png"))
                    imagenes += 1
    tipo = "escaneo (sin texto: leer las imágenes)" if escaneado else "con texto"
    print(f"{nombre}: {doc.page_count} pág., {texto_total} caracteres de texto, {tipo}, {imagenes} imágenes")
    return nombre


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    carpeta = sys.argv[1]
    os.makedirs(carpeta, exist_ok=True)
    for ruta in sys.argv[2:]:
        try:
            procesar(ruta, carpeta)
        except Exception as e:  # un PDF roto no debe frenar a los demás
            print(f"ERROR con {os.path.basename(ruta)}: {e}")
