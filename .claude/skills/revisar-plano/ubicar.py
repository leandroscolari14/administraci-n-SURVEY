"""Ubica una parcela en IDESF y dibuja las calles de alrededor, con el norte hacia arriba.

Uso:
    python -I -X utf8 ubicar.py <carpeta_salida> <folio.pdf | folio.txt | nomenclatura | partida>

La nomenclatura es distrito(4) + sección(2) + manzana(4) + parcela(5), 15 dígitos
(ej. "10 11 03 0018 00065"). La partida (P.I.I.) son 16 dígitos
(ej. "00-00-00 000000/0000"): con ella se consulta primero el SCIT, que da la parcela,
la ubicación y el plano. Al servidor de la provincia solo se le envía ese dato.

Genera:
    croquis.png  parcelas (la buscada en rojo) con nombres y numeración de calles
    calles.png   la misma zona más amplia, solo manzanas y nombres de calles
y muestra la ubicación y el azimut de cada lado de la parcela, para controlar el norte.
"""
import html
import http.cookiejar
import io
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request

from PIL import Image, ImageChops, ImageDraw, ImageFont
from pyproj import Transformer

SCIT = "https://www.santafe.gob.ar/tramites-scit/t-cons/consultarPartida"
PAGINA = "https://www.santafe.gob.ar/idesf/buscadorparcela/web/index.php?MAPA_INCORPORADO=true&TRAMITE=true"
BUSCADOR = "https://www.santafe.gob.ar/idesf/buscadorparcela/web/proxyPTRxml.php"
WMS = "https://aswe.santafe.gov.ar/idesf/publico-wms"
AGENTE = {"User-Agent": "Mozilla/5.0 revisar-plano"}
GRIS = (218, 219, 219)   # relleno de las parcelas en la capa scit_parcelas
MPP_PARCELAS = 0.2       # metros por píxel: con más de ~0,25 el servidor no dibuja las parcelas
MAX_PX = 2000


def leer_nomenclatura(arg):
    if os.path.isfile(arg):
        if arg.lower().endswith(".pdf"):
            import pymupdf
            texto = "\n".join(p.get_text() for p in pymupdf.open(arg))
        else:
            texto = open(arg, encoding="utf-8", errors="replace").read()
        # el set de datos lista antes a los linderos: la parcela propia está en su "Folio Catastral"
        _, marca, resto = texto.partition("Análisis de Folio Catastral")
        texto = resto if marca else texto
        m = re.search(r"\b(\d{2})[ \t]+(\d{2})[ \t]+(\d{2})[ \t]+(\d{4})[ \t]+(\d{5})\b", texto)
        if not m:
            m = re.search(r"(?<!\d)(\d{15})(?!\d)", texto)
        if not m:
            sys.exit("No encontré la nomenclatura en el archivo: pasala a mano (15 dígitos).")
        return "".join(m.groups())
    nom = re.sub(r"[\s\-./]", "", arg).upper()
    if len(nom) == 16 and nom.isdigit():
        return consultar_partida(nom)
    if len(nom) != 15:
        sys.exit("Pasá la nomenclatura (15 caracteres: distrito(4) sección(2) manzana(4) parcela(5)) "
                 "o la partida completa (16 dígitos).")
    return nom


def sesion():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())).open


def consultar_partida(partida):
    """Consulta la partida (16 dígitos) en el SCIT, muestra sus datos y devuelve la nomenclatura."""
    abrir = sesion()
    pagina = pedir(abrir, urllib.request.Request(SCIT, headers=AGENTE)).decode("utf-8", "replace")
    token = (re.search(r'form_consulta\[_token\][^>]*value="([^"]*)"', pagina)
             or re.search(r'value="([^"]*)"[^>]*name="form_consulta\[_token\]"', pagina))
    if not token:
        sys.exit("El SCIT no devolvió el formulario de consulta. Probá más tarde o pasá la nomenclatura.")
    p = partida
    cuerpo = urllib.parse.urlencode({
        "form_consulta[partida]": f"{p[:2]}-{p[2:4]}-{p[4:6]} {p[6:12]}/{p[12:]}",
        "form_consulta[Consultar]": "",
        "form_consulta[_token]": token.group(1),
    }).encode()
    res = pedir(abrir, urllib.request.Request(SCIT, data=cuerpo, headers=AGENTE)).decode("utf-8", "replace")
    if "La partida no existe" in res:
        sys.exit("La partida no existe en el SCIT.")

    parcelas = []
    for tabla in re.findall(r"<table.*?</table>", res, re.S):
        titulo = " ".join(re.sub(r"<[^>]+>", " ", tabla).split()).upper()
        for fila in re.findall(r"<tr.*?</tr>", tabla, re.S):
            c = [" ".join(html.unescape(re.sub(r"<[^>]+>", " ", v)).split())
                 for v in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", fila, re.S)]
            if not c:
                continue
            if "DATOS GENERALES DE LA PARTIDA" in titulo and len(c) >= 6 and re.match(r"\d{2}-\d{2}-\d{2}", c[0]):
                print(f"SCIT, partida {c[0]} ({c[1]}): {c[2] or 'sin ubicación'} - zona {c[3]} - terreno {c[4]}, edificado {c[5]}")
            nom = re.sub(r"[^A-Za-z0-9]", "", c[0]).upper()
            if "DATOS DE PARCELAS POR PARTIDA" in titulo and len(nom) >= 15 and nom[:6].isdigit():
                parcelas.append(nom[:15])
                # columnas: parcela, regional, número y año del plano, manzana, lote
                detalle = (f"plano N° {c[2]} / {c[3]} (regional {c[1]}), manzana {c[4]}, lote {c[5]}"
                           if len(c) == 6 else " | ".join(c[1:]))
                print(f"SCIT, parcela {nom[:15]}: {detalle}")
    if not parcelas:
        sys.exit("El SCIT no devolvió la parcela de esa partida: pasá la nomenclatura.")
    if len(set(parcelas)) > 1:
        print(f"La partida tiene varias parcelas: ubico la {parcelas[0]} (las otras se pasan por nomenclatura).")
    return parcelas[0]


def pedir(abrir, pedido, intentos=3):
    for i in range(1, intentos + 1):
        try:
            return abrir(pedido, timeout=90).read()
        except OSError as e:   # incluye timeouts y errores 5xx
            if i == intentos:
                sys.exit(f"El servidor de la provincia no respondió ({e}). Probá de nuevo más tarde.")
            time.sleep(5 * i)


def buscar_parcela(nom):
    abrir = sesion()
    cab = {**AGENTE, "X-Requested-With": "XMLHttpRequest", "Referer": PAGINA, "Origin": "https://www.santafe.gob.ar"}
    pedir(abrir, urllib.request.Request(PAGINA, headers=cab))
    res = {}
    for modo in ("extent", "centro"):
        cuerpo = urllib.parse.urlencode({"idParcela": nom}).encode()
        r = pedir(abrir, urllib.request.Request(f"{BUSCADOR}?request={modo}", data=cuerpo, headers=cab))
        try:
            res[modo] = [float(v) for v in json.loads(r.decode("utf-8-sig").strip())]
        except (ValueError, TypeError):
            sys.exit(f"IDESF no devolvió la parcela {nom} (revisá la nomenclatura).")
    # extent viene como lon,lat,lon,lat y centro como lat,lon
    lat, lon = res["centro"]
    return lat, lon, res["extent"]


def mapa(capas, cx, cy, lado, px):
    q = urllib.parse.urlencode({
        "service": "WMS", "version": "1.1.1", "request": "GetMap", "layers": capas, "styles": "",
        "srs": "EPSG:22185", "bbox": f"{cx - lado / 2},{cy - lado / 2},{cx + lado / 2},{cy + lado / 2}",
        "width": px, "height": px, "format": "image/png", "transparent": "false", "bgcolor": "0xFFFFFF",
    })
    for intento in range(1, 4):
        datos = pedir(urllib.request.urlopen, urllib.request.Request(f"{WMS}?{q}", headers=AGENTE))
        if datos[:4] != b"\x89PNG":
            sys.exit("El mapa de IDESF devolvió un error: " + datos[:200].decode("latin1", "replace"))
        img = Image.open(io.BytesIO(datos)).convert("RGB")
        if min(v for v, _ in img.getextrema()) < 255:
            break
        # a veces el servidor devuelve la imagen en blanco aunque haya datos
        if intento < 3:
            time.sleep(4 * intento)
    return img


def envolvente(puntos):
    puntos = sorted(set(puntos))

    def mitad(ps):
        h = []
        for p in ps:
            while len(h) > 1 and (h[-1][0] - h[-2][0]) * (p[1] - h[-2][1]) - (h[-1][1] - h[-2][1]) * (p[0] - h[-2][0]) <= 0:
                h.pop()
            h.append(p)
        return h[:-1]

    return mitad(puntos) + mitad(puntos[::-1])


def simplificar(linea, tol):
    if len(linea) < 3:
        return linea
    (x1, y1), (x2, y2) = linea[0], linea[-1]
    largo = math.hypot(x2 - x1, y2 - y1) or 1
    dist = [abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y1)) / largo for x, y in linea[1:-1]]
    peor = max(dist)
    if peor <= tol:
        return [linea[0], linea[-1]]
    i = dist.index(peor) + 1
    return simplificar(linea[:i + 1], tol)[:-1] + simplificar(linea[i:], tol)


def lados(mascara, mpp):
    """Lados (largo en m, azimut 0-180° desde el norte hacia el este) de la parcela pintada."""
    ancho, alto = mascara.size
    datos = mascara.load()
    caja = mascara.getbbox()
    puntos = []
    for y in range(caja[1], caja[3]):
        xs = [x for x in range(caja[0], caja[2]) if datos[x, y]]
        if xs:
            puntos += [(xs[0], y), (xs[-1] + 1, y), (xs[0], y + 1), (xs[-1] + 1, y + 1)]
    borde = envolvente(puntos)
    lejos = max(range(len(borde)), key=lambda i: math.dist(borde[0], borde[i]))
    poli = simplificar(borde[:lejos + 1], 3)[:-1] + simplificar(borde[lejos:] + borde[:1], 3)
    res = []
    for (x1, y1), (x2, y2) in zip(poli, poli[1:]):
        largo = math.hypot(x2 - x1, y2 - y1) * mpp
        if largo >= 3:
            res.append((largo, math.degrees(math.atan2(x2 - x1, y1 - y2)) % 180))
    return res


def dibujar_norte(img):
    d = ImageDraw.Draw(img)
    X, Y = img.width - 110, 80
    d.rectangle([X - 55, Y - 60, X + 55, Y + 190], fill="white", outline="black")
    d.polygon([(X, Y - 40), (X - 30, Y + 70), (X, Y + 45), (X + 30, Y + 70)], fill="black")
    try:
        fuente = ImageFont.truetype("arialbd.ttf", 48)
    except OSError:
        fuente = ImageFont.load_default()
    d.text((X, Y + 100), "N", font=fuente, fill="black", anchor="ma")


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    salida, nom = sys.argv[1], leer_nomenclatura(sys.argv[2])
    os.makedirs(salida, exist_ok=True)
    lat, lon, ext = buscar_parcela(nom)
    a_plano = Transformer.from_crs("EPSG:4326", "EPSG:22185", always_xy=True)
    cx, cy = a_plano.transform(lon, lat)
    (x1, y1), (x2, y2) = a_plano.transform(ext[0], ext[1]), a_plano.transform(ext[2], ext[3])
    parcela = max(abs(x2 - x1), abs(y2 - y1))
    print(f"Nomenclatura {nom}: lat {lat:.6f}, lon {lon:.6f} (parcela de unos {parcela:.0f} m)")

    # Calles: zona amplia. En parcelas grandes se agranda para que entren los alrededores.
    lado_calles = max(320.0, parcela * 1.8)
    calles = mapa("scit_manz_pcia,ipec_ejes_prov", cx, cy, lado_calles, 1100)
    calles.save(os.path.join(salida, "calles.png"))
    print("Calles:", os.path.join(salida, "calles.png"))

    lado = max(200.0, parcela * 1.4)
    px = round(lado / MPP_PARCELAS)
    marcada = None
    if px <= MAX_PX:
        base = mapa("scit_parcelas", cx, cy, lado, px)
        centro = (round(px / 2), round(px / 2))
        if all(abs(a - b) <= 8 for a, b in zip(base.getpixel(centro), GRIS)):
            antes = base.copy()
            ImageDraw.floodfill(base, centro, (255, 140, 140), thresh=8)
            marcada = ImageChops.difference(base, antes).convert("L").point(lambda v: 255 if v else 0)

    ruta = os.path.join(salida, "croquis.png")
    if marcada is None:   # sin dibujo de la parcela (rural, muy grande o sin datos): se marca su envolvente
        img = calles
        f = img.width / lado_calles
        d = ImageDraw.Draw(img)
        d.rectangle([(min(x1, x2) - cx) * f + img.width / 2, img.height / 2 - (max(y1, y2) - cy) * f,
                     (max(x1, x2) - cx) * f + img.width / 2, img.height / 2 - (min(y1, y2) - cy) * f],
                    outline=(220, 0, 0), width=4)
        dibujar_norte(img)
        img.save(ruta)
        print("Croquis:", ruta)
        print("No pude aislar la parcela en el parcelario: el rectángulo rojo es solo su envolvente y no hay azimuts.")
        return

    # Nombres de calles: se piden en una zona más amplia (a esa escala sí se dibujan) y se recortan.
    lado_txt = lado * 1.5
    txt = mapa("scit_manz_pcia,ipec_ejes_prov", cx, cy, lado_txt, px)
    margen = round(txt.width * (1 - lado / lado_txt) / 2)
    grande = max(1500, px)
    txt = txt.crop((margen, margen, txt.width - margen, txt.height - margen)).convert("L")
    txt = txt.resize((grande, grande), Image.LANCZOS)
    img = base.resize((grande, grande), Image.LANCZOS)
    img.paste((20, 20, 20), (0, 0), txt.point(lambda v: 255 if v < 150 else 0))
    dibujar_norte(img)
    img.save(ruta)
    print("Croquis:", ruta)

    print("Lados de la parcela (aproximados; azimut desde el norte hacia el este, 0-180°):")
    for largo, az in lados(marcada, lado / px):
        print(f"  {largo:7.1f} m   azimut {az:5.1f}°")


if __name__ == "__main__":
    main()
