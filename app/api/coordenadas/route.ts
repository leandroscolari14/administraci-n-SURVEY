export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Consulta el "Buscador de Parcelas Catastrales" de la IDESF para obtener
 * el rectángulo envolvente (bounding box) y/o el centro de una parcela,
 * calculados por el propio catastro sobre su base geométrica.
 *
 * Flujo:
 *   1) GET a la página del buscador para conseguir cookies de sesión
 *      (el proxy interno de la IDESF exige sesión activa).
 *   2) POST a proxyPTRxml.php?request=extent|centro con idParcela (15 dígitos
 *      compactos: distrito(4) + sección(2) + manzana(4) + parcela(5)).
 *
 * OJO con el orden de ejes: "extent" devuelve [lon, lat, lon, lat],
 * mientras que "centro" devuelve [lat, lon]. No son iguales.
 */

const PAGINA_URL = 'https://www.santafe.gob.ar/idesf/buscadorparcela/web/index.php?MAPA_INCORPORADO=true&TRAMITE=true';
const PROXY_URL = 'https://www.santafe.gob.ar/idesf/buscadorparcela/web/proxyPTRxml.php';

const HEADERS_BASE = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Consulta-Catastral-Personal',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer': PAGINA_URL,
  'Origin': 'https://www.santafe.gob.ar',
};

function extraerCookies(resp: Response) {
  const headersAny = resp.headers as any;
  const setCookie = typeof headersAny.getSetCookie === 'function'
    ? headersAny.getSetCookie()
    : (resp.headers.get('set-cookie') ? [resp.headers.get('set-cookie') as string] : []);
  return setCookie.map((c: string) => c.split(';')[0]).join('; ');
}

async function pedirExtentOCentro(modo: string, idParcela: string, cookieHeader: string) {
  const resp = await fetch(`${PROXY_URL}?request=${modo}`, {
    method: 'POST',
    headers: {
      ...HEADERS_BASE,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: new URLSearchParams({ idParcela }).toString(),
  });
  if (!resp.ok) return null;
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const idParcela = (req.nextUrl.searchParams.get('idParcela') || '').replace(/[^a-zA-Z0-9]/g, '');

  if (idParcela.length !== 15) {
    return NextResponse.json({ error: 'idParcela debe tener 15 dígitos (distrito+sección+manzana+parcela)' }, { status: 400 });
  }

  try {
    const pagina = await fetch(PAGINA_URL, { headers: HEADERS_BASE });
    const cookieHeader = extraerCookies(pagina);

    const [extent, centro] = await Promise.all([
      pedirExtentOCentro('extent', idParcela, cookieHeader),
      pedirExtentOCentro('centro', idParcela, cookieHeader),
    ]);

    if (!extent) {
      return NextResponse.json({ error: 'No se pudo obtener el extent de la parcela (sesión o parcela inválida)' }, { status: 502 });
    }

    return NextResponse.json({ extent, centro });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
