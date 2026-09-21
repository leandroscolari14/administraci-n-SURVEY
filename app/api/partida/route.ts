export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Integración con el SCIT de Santa Fe (consulta de partida inmobiliaria).
 *
 * Flujo:
 *   1) GET a la página del formulario para conseguir cookies de sesión
 *      y el token CSRF (form_consulta[_token]), que cambia en cada carga.
 *   2) POST simulando el envío del formulario con la partida formateada,
 *      el token recién obtenido y las mismas cookies.
 *   3) Devuelve el HTML de respuesta (con la tabla de datos) al frontend,
 *      que lo parsea del lado del cliente.
 */

const SCIT_URL = 'https://www.santafe.gob.ar/tramites-scit/t-cons/consultarPartida';

const HEADERS_BASE = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Consulta-Catastral-Personal',
};

// La partida se ingresa como 16 dígitos (con o sin separadores) y el
// formulario del SCIT espera el formato con máscara "00-00-00 000000/0000".
function normalizarPartida(input: string) {
  const soloDigitos = input.replace(/\D/g, '');
  if (soloDigitos.length === 16) {
    return (
      soloDigitos.slice(0, 2) + '-' +
      soloDigitos.slice(2, 4) + '-' +
      soloDigitos.slice(4, 6) + ' ' +
      soloDigitos.slice(6, 12) + '/' +
      soloDigitos.slice(12, 16)
    );
  }
  return input;
}

function extraerCookies(resp: Response) {
  const headersAny = resp.headers as any;
  const setCookie = typeof headersAny.getSetCookie === 'function'
    ? headersAny.getSetCookie()
    : (resp.headers.get('set-cookie') ? [resp.headers.get('set-cookie') as string] : []);
  return setCookie.map((c: string) => c.split(';')[0]).join('; ');
}

function extraerToken(html: string) {
  const m = html.match(/form_consulta\[_token\][^>]*value="([^"]*)"/)
    || html.match(/value="([^"]*)"[^>]*name="form_consulta\[_token\]"/);
  return m ? m[1] : null;
}

export async function GET(req: NextRequest) {
  const partidaInput = (req.nextUrl.searchParams.get('partida') || '').trim();

  if (!partidaInput) {
    return NextResponse.json({ error: 'falta el parámetro partida' }, { status: 400 });
  }

  try {
    const pagina = await fetch(SCIT_URL, { headers: HEADERS_BASE });
    const cookieHeader = extraerCookies(pagina);
    const html = await pagina.text();
    const token = extraerToken(html);

    if (!token) {
      return NextResponse.json({ error: 'no se pudo obtener el token del formulario (form_consulta[_token])' }, { status: 502 });
    }

    const partida = normalizarPartida(partidaInput);
    const body = new URLSearchParams({
      'form_consulta[partida]': partida,
      'form_consulta[Consultar]': '',
      'form_consulta[_token]': token,
    });

    const respuesta = await fetch(SCIT_URL, {
      method: 'POST',
      headers: {
        ...HEADERS_BASE,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: body.toString(),
    });

    if (!respuesta.ok) {
      return NextResponse.json({ error: 'el SCIT respondió con error', status: respuesta.status }, { status: 502 });
    }

    const htmlResultado = await respuesta.text();
    return NextResponse.json({ html: htmlResultado });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
