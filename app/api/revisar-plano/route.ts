export const dynamic = 'force-dynamic';
// El análisis con thinking + PDF puede tardar 2-4 minutos; sin esto Vercel
// corta la función con su límite de duración por defecto (10-15s).
export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { PROMPT_REVISION_V2, instruccionesDocumentos, ESQUEMA_SALIDA_V2 } from '@/app/lib/normativaPlanos';

/**
 * Recibe un plano de mensura en PDF (y, si se quiere, la escritura y el set de
 * datos del SCIT) y lo manda a la API de Claude para que lo revise buscando
 * concordancia, faltantes y errores de tipeo. Es un proxy sin estado: no toca
 * las tablas de la app, solo hace el análisis y devuelve el JSON de hallazgos.
 * La subida a Storage y el guardado en revisiones_planos los hace el cliente.
 *
 * Gasta de la clave de Anthropic, así que solo responde a usuarios logueados y autorizados.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const EMAILS_PERMITIDOS = [
  'leandroscolari14@gmail.com',
  'brunoverga13@gmail.com',
];

// Vercel limita el cuerpo de una función a 4,5 MB en total.
const MAX_BYTES_TOTAL = 4.2 * 1024 * 1024;
// Un poco antes de maxDuration, para alcanzar a devolver lo que haya escrito.
const LIMITE_MS = 280_000;

function limpiarJSON(texto: string) {
  return texto
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');
}

// Si la respuesta se cortó (límite de largo o de tiempo), rescata el resumen y los hallazgos que quedaron completos.
function recuperarJSON(texto: string): { resultado: any; incompleto: boolean } | null {
  const limpio = limpiarJSON(texto);
  try {
    return { resultado: JSON.parse(limpio), incompleto: false };
  } catch {
    // sigue abajo
  }

  let resumen = '';
  const m = limpio.match(/"resumen"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m) {
    try { resumen = JSON.parse(`"${m[1]}"`); } catch { resumen = m[1]; }
  }

  const hallazgos: any[] = [];
  const inicio = limpio.indexOf('"hallazgos"');
  const corchete = inicio >= 0 ? limpio.indexOf('[', inicio) : -1;
  if (corchete >= 0) {
    let i = corchete + 1;
    while (i < limpio.length) {
      if (limpio[i] !== '{') { i++; continue; }
      let profundidad = 0, enCadena = false, escapado = false, fin = -1;
      for (let j = i; j < limpio.length; j++) {
        const c = limpio[j];
        if (enCadena) {
          if (escapado) escapado = false;
          else if (c === '\\') escapado = true;
          else if (c === '"') enCadena = false;
        } else if (c === '"') enCadena = true;
        else if (c === '{') profundidad++;
        else if (c === '}') { profundidad--; if (profundidad === 0) { fin = j; break; } }
      }
      if (fin < 0) break; // el último objeto quedó cortado
      try { hallazgos.push(JSON.parse(limpio.slice(i, fin + 1))); } catch { /* se descarta */ }
      i = fin + 1;
    }
  }

  if (!resumen && hallazgos.length === 0) return null;
  return { resultado: { resumen: resumen || 'El análisis se cortó antes de terminar.', hallazgos }, incompleto: true };
}

function comoPdf(valor: FormDataEntryValue | null): Blob | null {
  return valor instanceof Blob && valor.size > 0 ? valor : null;
}

async function pdfABloque(archivo: Blob, titulo: string) {
  const base64 = Buffer.from(await archivo.arrayBuffer()).toString('base64');
  return {
    type: 'document' as const,
    title: titulo,
    source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
  };
}

export async function POST(req: NextRequest) {
  const accessToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!accessToken) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: dataUsuario, error: errorUsuario } = await supabase.auth.getUser(accessToken);
  const email = dataUsuario.user?.email;
  if (errorUsuario || !email || !EMAILS_PERMITIDOS.includes(email)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY no está configurada en el servidor.' }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el envío (puede ser demasiado pesado).' }, { status: 400 });
  }

  const plano = comoPdf(formData.get('archivo'));
  const escritura = comoPdf(formData.get('escritura'));
  const set = comoPdf(formData.get('set'));

  if (!plano) {
    return NextResponse.json({ error: 'Falta el archivo del plano (campo "archivo").' }, { status: 400 });
  }
  const adjuntos = [plano, escritura, set].filter((a): a is Blob => !!a);
  if (adjuntos.some((a) => a.type && a.type !== 'application/pdf')) {
    return NextResponse.json({ error: 'Todos los archivos tienen que ser PDF.' }, { status: 400 });
  }
  if (adjuntos.reduce((suma, a) => suma + a.size, 0) > MAX_BYTES_TOTAL) {
    return NextResponse.json({ error: 'Los archivos pesan más de 4 MB en total. Usá versiones más livianas o solo las hojas necesarias de la escritura.' }, { status: 413 });
  }

  const nombreDe = (a: Blob | null) => (a && 'name' in a ? String((a as File).name) : null);

  const contenido: Anthropic.Messages.ContentBlockParam[] = [await pdfABloque(plano, 'Plano de mensura (el que hay que revisar)')];
  if (escritura) contenido.push(await pdfABloque(escritura, 'Escritura / título de propiedad'));
  if (set) contenido.push(await pdfABloque(set, 'Set de datos (Informe Catastral del SCIT)'));
  contenido.push({
    type: 'text',
    text: `Revisá el plano de mensura (el primer documento)${escritura || set ? ' y contrastalo con los documentos adjuntos' : ''}, y devolvé el JSON pedido.`,
  });

  const sistema = [PROMPT_REVISION_V2, instruccionesDocumentos({ escritura: !!escritura, set: !!set }), ESQUEMA_SALIDA_V2].join('\n\n');

  const client = new Anthropic({ apiKey });
  let texto = '';
  let corte: string | null = null;

  try {
    const stream = client.messages.stream(
      {
        model: 'claude-opus-5',
        max_tokens: 20000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        system: sistema,
        messages: [{ role: 'user', content: contenido }],
      },
      { signal: AbortSignal.timeout(LIMITE_MS) }
    );
    stream.on('text', (fragmento) => { texto += fragmento; });
    const final = await stream.finalMessage();
    if (final.stop_reason === 'max_tokens') corte = 'largo';
    const bloque = final.content.find((b) => b.type === 'text');
    if (bloque && bloque.type === 'text') texto = bloque.text;
  } catch (err: any) {
    const esTiempo = err?.name === 'AbortError' || err?.name === 'APIUserAbortError' || /abort|timed? ?out/i.test(String(err));
    if (!esTiempo || !texto) {
      return NextResponse.json({ error: esTiempo ? 'El análisis tardó demasiado. Probá de nuevo o con menos páginas.' : String(err) }, { status: esTiempo ? 504 : 500 });
    }
    corte = 'tiempo';
  }

  if (!texto) {
    return NextResponse.json({ error: 'La respuesta de Claude no incluyó texto.' }, { status: 502 });
  }

  const recuperado = recuperarJSON(texto);
  if (!recuperado) {
    return NextResponse.json({ error: 'No se pudo interpretar la respuesta del análisis.', respuestaCruda: texto }, { status: 502 });
  }

  return NextResponse.json({
    ...recuperado.resultado,
    version: 2,
    ...(recuperado.incompleto || corte ? { incompleto: true, motivo_corte: corte || 'largo' } : {}),
    documentos: { escritura: nombreDe(escritura), set: nombreDe(set) },
  });
}
