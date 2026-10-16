export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Recibe las órdenes que los socios le mandan al bot de Telegram (/usar, /liberar, /estado
// y el botón "Liberar ahora" del aviso) y actualiza el estado del SCIT en estado_catastro.
//
// Seguridad: Telegram manda el secreto TELEGRAM_WEBHOOK_SECRET en un encabezado, y solo se
// obedece a los usuarios de TELEGRAM_USUARIOS ("id:Nombre,id:Nombre"). La clave
// SUPABASE_SERVICE_ROLE_KEY es privada del servidor: el bot no tiene sesión de usuario y
// las políticas de la base solo dejan escribir a los dos mails de los socios.

const TELEGRAM_API = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

function usuariosAutorizados(): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const par of (process.env.TELEGRAM_USUARIOS || '').split(',')) {
    const [id, nombre] = par.split(':').map(s => s.trim());
    if (id && nombre) mapa[id] = nombre;
  }
  return mapa;
}

async function telegram(metodo: string, cuerpo: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '';
  if (!token) return;
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  } catch (err) {
    console.error(err);
  }
}

function hace(desdeIso: string) {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(desdeIso).getTime()) / 60000));
  const h = Math.floor(minutos / 60);
  return h > 0 ? `${h}h ${minutos % 60}m` : `${minutos}m`;
}

const AYUDA =
  '*Comandos*\n' +
  '/estado - ver si el SCIT está libre o en uso\n' +
  '/usar - marcar que lo estás usando\n' +
  '/liberar - marcar el SCIT como libre\n' +
  '/id - ver tu ID de Telegram';

export async function POST(req: NextRequest) {
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secreto) return NextResponse.json({ error: 'No configurado' }, { status: 503 });
  if (req.headers.get('x-telegram-bot-api-secret-token') !== secreto) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const callback = update.callback_query;
  const mensaje = callback ? callback.message : update.message;
  const from = callback ? callback.from : update.message?.from;
  if (!mensaje || !from) return NextResponse.json({ ok: true });

  const chatId = mensaje.chat.id;
  const grupoId = process.env.TELEGRAM_CHAT_ID || process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || '';

  let comando = '';
  if (callback) comando = String(callback.data || '');
  else {
    const texto = String(update.message.text || '').trim();
    if (!texto.startsWith('/')) return NextResponse.json({ ok: true });
    comando = texto.slice(1).split(/[\s@]/)[0].toLowerCase();
  }

  const responder = (texto: string) =>
    callback
      ? telegram('answerCallbackQuery', { callback_query_id: callback.id, text: texto.replace(/[*_`]/g, '') })
      : telegram('sendMessage', { chat_id: chatId, text: texto, parse_mode: 'Markdown' });

  if (comando === 'id') {
    await responder(`Tu ID de Telegram es \`${from.id}\``);
    return NextResponse.json({ ok: true });
  }

  const nombre = usuariosAutorizados()[String(from.id)];
  const comandosConocidos = ['start', 'help', 'estado', 'usar', 'liberar'];
  if (!comandosConocidos.includes(comando)) return NextResponse.json({ ok: true });
  if (!nombre) {
    await responder(`No estás autorizado. Tu ID de Telegram es \`${from.id}\`; pasáselo a Leo para que te agregue.`);
    return NextResponse.json({ ok: true });
  }
  if (comando === 'start' || comando === 'help') {
    await responder(AYUDA);
    return NextResponse.json({ ok: true });
  }

  const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!claveServicio || !supabaseUrl) {
    await responder('Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.');
    return NextResponse.json({ ok: true });
  }
  const supabase = createClient(supabaseUrl, claveServicio, { auth: { persistSession: false } });

  const { data, error } = await supabase.from('estado_catastro').select('*').eq('id', 1).limit(1);
  if (error || !data || data.length === 0) {
    await responder('No pude leer el estado del SCIT. Probá de nuevo en un rato.');
    return NextResponse.json({ ok: true });
  }
  const estado = data[0];
  const enUso = estado.usuario !== 'Libre';

  // Avisa al grupo; si la orden ya vino del grupo, el aviso es la única respuesta.
  const avisarAlGrupo = async (texto: string) => {
    if (grupoId) await telegram('sendMessage', { chat_id: grupoId, text: texto, parse_mode: 'Markdown' });
    if (callback) await responder('Listo');
    else if (!grupoId || String(chatId) !== String(grupoId)) await responder('Listo');
  };

  if (comando === 'estado') {
    await responder(
      enUso ? `🔴 En uso por *${estado.usuario}* hace ${hace(estado.fecha_actualizacion)}` : '🟢 El SCIT está libre'
    );
  } else if (comando === 'usar') {
    if (enUso) {
      await responder(
        estado.usuario === nombre
          ? `Ya lo tenías vos desde hace ${hace(estado.fecha_actualizacion)}`
          : `Ya lo está usando *${estado.usuario}* hace ${hace(estado.fecha_actualizacion)}`
      );
    } else {
      const { error: errorUpdate } = await supabase
        .from('estado_catastro')
        .update({ usuario: nombre, fecha_actualizacion: new Date().toISOString() })
        .eq('id', 1);
      if (errorUpdate) await responder('No pude guardar el cambio. Probá de nuevo.');
      else await avisarAlGrupo(`🔴 *SISTEMA EN USO*\n\n*${nombre}* acaba de entrar al sistema SCIT de Catastro.`);
    }
  } else if (comando === 'liberar') {
    if (!enUso) {
      await responder('El SCIT ya estaba libre 🟢');
    } else {
      const { error: errorUpdate } = await supabase
        .from('estado_catastro')
        .update({ usuario: 'Libre', fecha_actualizacion: new Date().toISOString() })
        .eq('id', 1);
      if (errorUpdate) await responder('No pude guardar el cambio. Probá de nuevo.');
      else {
        await avisarAlGrupo(`🟢 *SISTEMA LIBERADO*\n\nEl sistema SCIT ya está disponible nuevamente (lo liberó *${nombre}*).`);
        if (callback) {
          await telegram('editMessageReplyMarkup', {
            chat_id: chatId,
            message_id: mensaje.message_id,
            reply_markup: { inline_keyboard: [] },
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
