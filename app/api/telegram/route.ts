export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Envía avisos al grupo de Telegram desde el servidor, para que el token del bot
// no viaje en el JavaScript público. Solo responde a usuarios logueados y autorizados.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const EMAILS_PERMITIDOS = [
  'leandroscolari14@gmail.com',
  'brunoverga13@gmail.com',
];

const MAX_MENSAJE = 4000;

async function llamarTelegram(botToken: string, metodo: string, cuerpo: Record<string, unknown>) {
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...cuerpo, parse_mode: 'Markdown' }),
  });
  return resp.ok;
}

export async function POST(req: NextRequest) {
  const accessToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!accessToken) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.auth.getUser(accessToken);
  const email = data.user?.email;
  if (error || !email || !EMAILS_PERMITIDOS.includes(email)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  const mensaje = typeof body?.mensaje === 'string' ? body.mensaje.trim() : '';
  if (!mensaje || mensaje.length > MAX_MENSAJE) {
    return NextResponse.json({ error: 'Mensaje inválido' }, { status: 400 });
  }

  // Solo se aceptan adjuntos del propio storage público de Supabase.
  const prefijoStorage = `${supabaseUrl}/storage/v1/object/public/`;
  const fotoUrl = typeof body?.fotoUrl === 'string' && body.fotoUrl.startsWith(prefijoStorage) ? body.fotoUrl : undefined;

  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || '';
  if (!botToken || !chatId) return NextResponse.json({ enviado: false, motivo: 'Telegram no configurado' });

  try {
    let enviado = false;
    if (fotoUrl) {
      const esPdf = /\.pdf(\?|$)/i.test(fotoUrl);
      enviado = esPdf
        ? await llamarTelegram(botToken, 'sendDocument', { chat_id: chatId, document: fotoUrl, caption: mensaje })
        : await llamarTelegram(botToken, 'sendPhoto', { chat_id: chatId, photo: fotoUrl, caption: mensaje });
    }
    // Si no había adjunto, o el adjunto falló, el aviso igual sale como texto.
    if (!enviado) enviado = await llamarTelegram(botToken, 'sendMessage', { chat_id: chatId, text: mensaje });
    return NextResponse.json({ enviado });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ enviado: false }, { status: 502 });
  }
}
