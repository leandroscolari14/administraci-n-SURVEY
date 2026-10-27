/**
 * El sitio de la provincia (www.santafe.gob.ar) bloquea las consultas que salen
 * de los servidores de Vercel (EEUU). Si están definidas SF_PROXY_URL y
 * SF_PROXY_KEY, los pedidos a ese host se mandan al reenviador que corre en la
 * PC de casa (el mismo que usa catastro-sf), indicando el destino real en
 * x-target-url. Sin esas variables se consulta directo (útil en desarrollo).
 */

const HOST_SF = 'www.santafe.gob.ar';

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchSF(url: string, opts: RequestInit = {}): Promise<Response> {
  const proxy = process.env.SF_PROXY_URL;
  const clave = process.env.SF_PROXY_KEY;
  if (!proxy || !clave || new URL(url).hostname !== HOST_SF) return fetch(url, opts);

  const esGet = !opts.method || opts.method.toUpperCase() === 'GET';
  const pedido: RequestInit = {
    ...opts,
    headers: { ...(opts.headers as Record<string, string>), 'x-target-url': url, 'x-proxy-key': clave },
  };

  // La conexión por Tailscale Funnel puede fallar de manera transitoria: se
  // reintenta (solo los GET ante 502/503/504, que son idempotentes).
  const INTENTOS = 3;
  let ultimoError: unknown;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const resp = await fetch(proxy, pedido);
      if (esGet && [502, 503, 504].includes(resp.status) && intento < INTENTOS) {
        await pausa(400 * intento);
        continue;
      }
      return resp;
    } catch (err) {
      ultimoError = err;
      if (intento < INTENTOS) await pausa(400 * intento);
    }
  }
  throw ultimoError;
}

export function causaDelError(err: unknown) {
  const causa = (err as any)?.cause;
  return causa ? `${causa.code || ''} ${causa.message || causa}`.trim() : null;
}
