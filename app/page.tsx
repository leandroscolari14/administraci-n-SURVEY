"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { ITEMS_CHECKLIST } from "@/app/lib/normativaPlanos";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const urlGoogleMaps = (lat: any, lng: any) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

const escaparHTML = (s: any) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// Gastos del trámite que se cargan por separado en Finanzas y se multiplican por la cantidad de lotes.
// El certificado lo paga quien carga el expediente; el título y el SET los paga siempre Bruno.
const GASTO_CERTIFICADO = 20800;
const GASTO_TITULO = 7500;
const GASTO_SET = 5200;
// Aportes de un expediente (uno solo, sin importar la cantidad de lotes).
const APORTE_CAJA = 83000;
const APORTE_COLEGIO = 69300;

// Cómo se guardan los gastos: extra_leo / extra_bruno según quién los paga. El certificado lo paga quien carga
// el expediente, el título y el SET siempre Bruno, y los extras de cada uno (viáticos, nafta, etc.) son de quien los puso.
const calcularExtras = (encargado: string, cantCert: number, cantTitulo: number, cantSet: number, extraLeo = 0, extraBruno = 0) => {
  const certificado = cantCert * GASTO_CERTIFICADO;
  const tituloSet = cantTitulo * GASTO_TITULO + cantSet * GASTO_SET;
  return encargado === "Leo"
    ? { extraLeo: certificado + extraLeo, extraBruno: tituloSet + extraBruno }
    : { extraLeo: extraLeo, extraBruno: certificado + tituloSet + extraBruno };
};

// Pasa los gastos guardados de un registro a cantidades + extras de cada uno. Lo que no salga de las
// cantidades (con los valores actuales) queda como extra de quien lo pagó, así nunca cambia un monto.
const derivarGastos = (f: any) => {
  const extraLeo = Number(f.extra_leo || 0), extraBruno = Number(f.extra_bruno || 0);
  const conExtras = (c: number, t: number, s: number) => {
    const e = calcularExtras(f.encargado, c, t, s);
    const sobraLeo = extraLeo - e.extraLeo, sobraBruno = extraBruno - e.extraBruno;
    return sobraLeo >= 0 && sobraBruno >= 0 ? { certificado: c, titulo: t, set: s, extraLeo: sobraLeo, extraBruno: sobraBruno } : null;
  };
  if (f.cant_certificado != null && f.cant_titulo != null && f.cant_set != null) {
    const r = conExtras(Number(f.cant_certificado), Number(f.cant_titulo), Number(f.cant_set));
    if (r) return r;
  }
  // Antes de separarlos, título y SET compartían una sola cantidad.
  if (f.cant_certificado != null && f.cant_titulo_set != null) {
    const r = conExtras(Number(f.cant_certificado), Number(f.cant_titulo_set), Number(f.cant_titulo_set));
    if (r) return r;
  }
  // Registros sin cantidades: se busca la combinación que reproduce exactamente los gastos.
  for (let c = 0; c <= 20; c++) for (let t = 0; t <= 20; t++) {
    const r = conExtras(c, t, t);
    if (r && r.extraLeo === 0 && r.extraBruno === 0) return r;
  }
  return { certificado: 0, titulo: 0, set: 0, extraLeo, extraBruno };
};

// Valores sugeridos al cargar: una entrega lleva aportes y gastos; un saldo va en cero.
const valoresFinanzaPorDefecto = (tramite: string, tipoPago: string) => tipoPago === "saldo" || tipoPago === "gastos"
  ? { caja: 0, colegio: 0, cantCert: 0, cantTitulo: 0, cantSet: 0, extraLeo: 0, extraBruno: 0 }
  : { caja: APORTE_CAJA, colegio: APORTE_COLEGIO, cantCert: 1, cantTitulo: tramite.toUpperCase().includes("REP") ? 1 : 0, cantSet: tramite.toUpperCase().includes("REP") ? 1 : 0, extraLeo: 0, extraBruno: 0 };

const estadoFinanzaInicial = { tramite: "VEP", propietario: "", encargado: "Leo", ingreso: 0, caja: APORTE_CAJA, colegio: APORTE_COLEGIO, tipoPago: "entrega" as "entrega" | "saldo" | "gastos", cantCert: 1, cantTitulo: 0, cantSet: 0, extraLeo: 0, extraBruno: 0, esGasto5050: false };

const ETAPAS_BASE = [
  { id: 'e_solicitado_ld', label: 'Solicitar LD' }, { id: 'e_medido', label: 'Medir' },
  { id: 'e_aportes_generados', label: 'Aportes' }, { id: 'e_definido', label: 'Definir' }, { id: 'e_fac', label: 'FAC' },
  { id: 'e_saca', label: 'SACA' }, { id: 'e_scit', label: 'SCIT' }, { id: 'e_pedido_cc', label: 'Pedir CC' },
  { id: 'e_aprobado', label: 'Aprobado' }
];

// FAC tiene solo dos botones, cada uno con varias fases (ver ETAPAS_MULTIFASE): Medir / Medido / Dibujado y Meter / Iniciado / Aprobado.
const ETAPAS_FAC = [
  { id: 'fac_medicion', label: 'Medir' }, { id: 'fac_tramite', label: 'Meter' }
];

// FAC tiene sus propias etapas. En el resto: "Solicitado LD" solo en VEP/REP;
// "Pedido CC" y "CC Emitido" solo en VEP/REP/CCU (los demás terminan en "Registrado");
// "Visado" (antes de Aprobado) en unificación, división y PH.
const obtenerEtapasParaTrabajo = (t: any) => {
  const tipo = (t.tipo || '').trim().toUpperCase();
  if (tipo === 'FAC') return ETAPAS_FAC;
  const esVepRep = tipo.includes('VEP') || tipo.includes('REP');
  const tieneCC = esVepRep || tipo.includes('CCU');
  const llevaVisado = tipo.includes('UNIFICA') || tipo.includes('DIV') || tipo.includes('PH');

  let etapas = ETAPAS_BASE.filter(e =>
    (e.id !== 'e_solicitado_ld' || esVepRep) && (e.id !== 'e_pedido_cc' || tieneCC)
  );
  if (llevaVisado) {
    const posAprobado = etapas.findIndex(e => e.id === 'e_aprobado');
    etapas = [...etapas.slice(0, posAprobado), { id: 'e_visado', label: 'Visado' }, ...etapas.slice(posAprobado)];
  }
  if (!tieneCC) {
    etapas = [...etapas, { id: 'e_registrado', label: 'Registrado' }];
  }
  return etapas;
};

// Etapas con varias fases. `columnas` es la cadena de columnas booleanas: la fase es la cantidad de
// columnas encendidas desde el principio (0 = sin tocar). `fases` nombra cada fase (para el tooltip) y
// `textos`, si está, cambia la palabra del botón según la fase. La última fase cuenta como completa.
// Con `maximo`, la fase es la última columna encendida aunque falte alguna anterior (así un registro con marcas
// salteadas muestra su avance real); al cambiar de fase igual se dejan las columnas ordenadas.
const ETAPAS_MULTIFASE: Record<string, { columnas: string[]; fases: string[]; textos?: string[]; maximo?: boolean }> = {
  e_fac: { columnas: ['e_fac', 'e_fac_aprobado'], fases: ['sin iniciar', 'iniciado', 'aprobado'] },
  e_visado: { columnas: ['e_visado', 'e_visado_aprobado'], fases: ['sin iniciar', 'iniciado', 'aprobado'] },
  e_aportes_generados: { columnas: ['e_aportes_generados', 'e_aportes_pagados'], fases: ['sin generar', 'generados', 'pagados'] },
  e_medido: { columnas: ['e_medido'], fases: ['medir', 'medido'], textos: ['Medir', 'Medido'] },
  fac_medicion: { columnas: ['e_medido', 'e_dibujado'], fases: ['medir', 'medido', 'dibujado'], textos: ['Medir', 'Medido', 'Dibujado'], maximo: true },
  fac_tramite: { columnas: ['e_iniciado', 'e_aprobado'], fases: ['meter', 'iniciado', 'aprobado'], textos: ['Meter', 'Iniciado', 'Aprobado'], maximo: true },
  e_solicitado_ld: { columnas: ['e_solicitado_ld'], fases: ['solicitar', 'solicitado'], textos: ['Solicitar LD', 'Solicitado LD'] },
  e_pedido_cc: {
    columnas: ['e_pedido_cc', 'e_cc_emitido'],
    fases: ['pedir', 'pedido', 'emitido'],
    textos: ['Pedir CC', 'CC pedido', 'CC emitido'],
  },
  e_definido: { columnas: ['e_definido', 'e_definido_dibujado'], fases: ['definir', 'dibujar', 'dibujado'], textos: ['Definir', 'Dibujar', 'Dibujado'] },
  e_saca: { columnas: ['e_saca', 'e_saca_cerrado'], fases: ['sin ingresar', 'ingresado', 'cerrado'], textos: ['SACA', 'SACA ingresado', 'SACA cerrado'] },
  e_scit: {
    columnas: ['e_scit', 'e_scit_observado', 'e_scit_reingresado'],
    fases: ['sin ingresar', 'ingresado', 'observado', 'reingresado'],
    textos: ['SCIT', 'SCIT ingresado', 'SCIT observado', 'SCIT reingresado'],
  },
};
const ultimaFaseEtapa = (id: string) => ETAPAS_MULTIFASE[id]?.columnas.length ?? 1;
const faseEtapa = (t: any, id: string) => {
  const config = ETAPAS_MULTIFASE[id];
  if (!config) return t[id] ? 1 : 0;
  if (config.maximo) {
    for (let i = config.columnas.length - 1; i >= 0; i--) if (t[config.columnas[i]]) return i + 1;
    return 0;
  }
  const apagada = config.columnas.findIndex(c => !t[c]);
  return apagada === -1 ? config.columnas.length : apagada;
};
const etapaCompleta = (t: any, id: string) => faseEtapa(t, id) === ultimaFaseEtapa(id);

const contarEtapasMarcadas = (t: any) => obtenerEtapasParaTrabajo(t).filter(e => etapaCompleta(t, e.id)).length;

// Pendientes primero; dentro de cada grupo, los que tienen menos etapas
// marcadas van arriba (así los recién agregados quedan siempre visibles).
const ordenarTrabajosPorPrioridad = (lista: any[]) => {
  return [...lista].sort((a, b) => {
    const aPendiente = a.color_alerta === 'amarillo' ? 0 : 1;
    const bPendiente = b.color_alerta === 'amarillo' ? 0 : 1;
    if (aPendiente !== bPendiente) return aPendiente - bPendiente;
    return contarEtapasMarcadas(a) - contarEtapasMarcadas(b);
  });
};

const normalizarTexto = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const aNumeroONull = (v: any) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));

// El orden se calcula al cargar los datos y no se recalcula al tocar una etapa,
// para que la tarjeta no se mueva de lugar mientras se la está marcando.
const ordenarSegunIds = (lista: any[], ids: string[]) => {
  const posicion = new Map(ids.map((id, i) => [id, i]));
  return [...lista].sort((a, b) => (posicion.get(a.id) ?? -1) - (posicion.get(b.id) ?? -1));
};

// Correos permitidos (Tuyo y de tu socio)
const EMAILS_PERMITIDOS = [
  "leandroscolari14@gmail.com",
  "brunoverga13@gmail.com"
];

const ETIQUETA_CATEGORIA_PLANO: Record<string, string> = {
  concordancia: "Concordancia",
  faltante: "Falta",
  tipeo: "Tipeo",
  presentacion: "Presentación",
  titulo: "Contra la escritura / set",
  verificar_titulo: "Verificar contra el título",
};

const NOMBRE_POR_EMAIL: Record<string, string> = {
  "leandroscolari14@gmail.com": "Leo",
  "brunoverga13@gmail.com": "Bruno"
};

export default function DashboardAgrimensura() {
  const [session, setSession] = useState<any>(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [emailLogin, setEmailLogin] = useState("");
  const [passwordLogin, setPasswordLogin] = useState("");
  const [errorLogin, setErrorLogin] = useState("");
  const [enviandoLogin, setEnviandoLogin] = useState(false);

  const [activeTab, setActiveTab] = useState("trabajos");
  const [subTabTrabajos, setSubTabTrabajos] = useState("activos");
  const [subTabFinanzas, setSubTabFinanzas] = useState("actual");
  
  const [leoAbierto, setLeoAbierto] = useState(false);
  const [brunoAbierto, setBrunoAbierto] = useState(false);
  
  const [aniosAbiertos, setAniosAbiertos] = useState<Record<string, boolean>>({});
  const [mesesAbiertos, setMesesAbiertos] = useState<Record<string, boolean>>({});
  
  const [aniosDashAbiertos, setAniosDashAbiertos] = useState<Record<string, boolean>>({});
  const [mesesDashAbiertos, setMesesDashAbiertos] = useState<Record<string, boolean>>({});
  
  const [aniosFinanzasAbiertos, setAniosFinanzasAbiertos] = useState<Record<string, boolean>>({});
  const [mesesFinanzasAbiertos, setMesesFinanzasAbiertos] = useState<Record<string, boolean>>({});
  const [semanasAbiertas, setSemanasAbiertas] = useState<Record<string, boolean>>({});
  
  const [trabajosActivos, setTrabajosActivos] = useState<any[]>([]);
  const [ordenTrabajos, setOrdenTrabajos] = useState<string[]>([]);
  const [notaEditando, setNotaEditando] = useState<{ id: string; valor: string } | null>(null);
  const notaEditandoRef = useRef<{ id: string; valor: string } | null>(null);
  const editarNota = (nota: { id: string; valor: string } | null) => {
    notaEditandoRef.current = nota;
    setNotaEditando(nota);
  };
  const [trabajosFinalizados, setTrabajosFinalizados] = useState<any[]>([]);
  const [finanzas, setFinanzas] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  
  const [catastro, setCatastro] = useState({ usuario: "Libre", fecha: "", liberadoPor: "", fechaLiberacion: "" });
  const [tiempoUso, setTiempoUso] = useState("");
  
  const [archivoComprobante, setArchivoComprobante] = useState<File | null>(null);

  const [archivoPlano, setArchivoPlano] = useState<File | null>(null);
  const [archivoEscritura, setArchivoEscritura] = useState<File | null>(null);
  const [archivoSet, setArchivoSet] = useState<File | null>(null);
  const [claveArchivosPlano, setClaveArchivosPlano] = useState(0);
  const [expedientePlano, setExpedientePlano] = useState<string>("");
  const [revisandoPlano, setRevisandoPlano] = useState(false);
  const [errorPlano, setErrorPlano] = useState("");
  const [resultadoPlanoActual, setResultadoPlanoActual] = useState<any | null>(null);
  const [revisionesPlanos, setRevisionesPlanos] = useState<any[]>([]);
  const [revisionesPlanosCargadas, setRevisionesPlanosCargadas] = useState(false);

  const tipoInputRef = useRef<HTMLInputElement>(null);
  const notasInputRef = useRef<HTMLInputElement>(null);

  const [nuevoTrabajo, setNuevoTrabajo] = useState({ 
    tipo: "", 
    propietario: "", 
    estado: "", 
    color: "verde", 
    encargado: "Leo",
    ubicacion: "",
    lat: "",
    lng: ""
  });
  const [sugerenciasDireccion, setSugerenciasDireccion] = useState<any[]>([]);
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);
  const debounceDireccionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idBusquedaDireccionRef = useRef(0);

  const [partidaInput, setPartidaInput] = useState("");
  const [buscandoPartida, setBuscandoPartida] = useState(false);
  const [errorPartida, setErrorPartida] = useState("");

  const [editandoTrabajoId, setEditandoTrabajoId] = useState<string | null>(null);
  const [trabajoEditandoDash, setTrabajoEditandoDash] = useState<any | null>(null);
  const [sugerenciasModal, setSugerenciasModal] = useState<any[]>([]);
  const [buscandoModal, setBuscandoModal] = useState(false);
  const [mensajeUbicacionModal, setMensajeUbicacionModal] = useState("");
  const [trabajoResaltadoId, setTrabajoResaltadoId] = useState<string | null>(null);
  
  const [editandoFinanzaId, setEditandoFinanzaId] = useState<string | null>(null);
  const [nuevaFinanza, setNuevaFinanza] = useState(estadoFinanzaInicial);

  const [filtroEncargado, setFiltroEncargado] = useState("Todos");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroTexto, setFiltroTexto] = useState("");

  const [filtroAnioDashboard, setFiltroAnioDashboard] = useState("Todos");
  const [filtroSocioDashboard, setFiltroSocioDashboard] = useState("Todos");
  const [filtroTipoDashboard, setFiltroTipoDashboard] = useState("Todos");
  const [busquedaDashboard, setBusquedaDashboard] = useState("");
  const estabaBuscandoRef = useRef(false);
  const [busquedaHistorial, setBusquedaHistorial] = useState("");
  const [mapaMedicionesAbierto, setMapaMedicionesAbierto] = useState(false);
  const [filtroSocioMediciones, setFiltroSocioMediciones] = useState("Todos");

  // Referencias para Leaflet (Mapa persistente)
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapMarkersMapRef = useRef<Map<string, any>>(new Map());
  const moverPinRef = useRef<(t: any, lat: number, lng: number, revertir: () => void) => void>(() => {});
  // Mapa de "Mediciones pendientes" (ventana aparte, con su propia instancia de Leaflet)
  const mapaMedContRef = useRef<HTMLDivElement>(null);
  const mapaMedRef = useRef<any>(null);
  const mapaMedCapaRef = useRef<any>(null);
  const mapaMedMarkersRef = useRef<Map<string, any>>(new Map());

  // Manejo de Sesión de Supabase (Persistencia automática en localStorage)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      validarYEstablecerSesion(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      validarYEstablecerSesion(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const validarYEstablecerSesion = (currentSession: any) => {
    if (currentSession) {
      const emailUser = currentSession.user?.email;
      if (EMAILS_PERMITIDOS.includes(emailUser)) {
        setSession(currentSession);
        cargarDatos();
      } else {
        alert("Acceso denegado. Este correo no está autorizado.");
        supabase.auth.signOut();
        setSession(null);
      }
    } else {
      setSession(null);
    }
    setCargandoAuth(false);
  };

  const iniciarSesionPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLogin("");
    setEnviandoLogin(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailLogin,
      password: passwordLogin,
    });
    if (error) {
      setErrorLogin("Email o contraseña incorrectos.");
    }
    setEnviandoLogin(false);
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  useEffect(() => {
    let intervalo: any;
    if (catastro.usuario !== "Libre" && catastro.fecha) {
      intervalo = setInterval(() => {
        const ahora = new Date().getTime();
        const inicio = new Date(catastro.fecha).getTime();
        const diferencia = ahora - inicio;
        const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((diferencia % (1000 * 60)) / 1000);
        setTiempoUso(`${horas}h ${minutos}m ${segundos}s`);
      }, 1000);
    } else { setTiempoUso(""); }
    return () => clearInterval(intervalo);
  }, [catastro]);

  // El estado del SCIT se muestra en todas las pantallas, así que se actualiza solo (también cuando el otro socio
  // lo cambia desde la app o desde Telegram) y al volver a la pestaña del navegador.
  useEffect(() => {
    if (!session) return;
    const refrescar = async () => {
      const { data } = await supabase.from("estado_catastro").select("*").limit(1);
      if (!data || data.length === 0) return;
      const nuevo = { usuario: data[0].usuario, fecha: data[0].fecha_actualizacion, liberadoPor: data[0].liberado_por || "", fechaLiberacion: data[0].fecha_liberacion || "" };
      setCatastro((prev) => JSON.stringify(prev) === JSON.stringify(nuevo) ? prev : nuevo);
    };
    const intervalo = setInterval(refrescar, 10000);
    const alVolver = () => { if (document.visibilityState === "visible") refrescar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { clearInterval(intervalo); document.removeEventListener("visibilitychange", alVolver); };
  }, [session]);

  const cargarDatos = async () => {
    const { data: dataTrabajos } = await supabase.from("trabajos_curso").select("*").order("id", { ascending: true });
    const { data: dataFinanzas } = await supabase.from("finanzas").select("*").eq("liquidado", false);
    const { data: dataHistorial } = await supabase.from("finanzas").select("*").eq("liquidado", true);
    const { data: dataCatastro } = await supabase.from("estado_catastro").select("*").limit(1);
    
    if (dataTrabajos) {
      const activos = dataTrabajos.filter((t: any) => t.finalizado === false || t.finalizado === null);
      const finalizados = dataTrabajos.filter((t: any) => t.finalizado === true);
      setTrabajosActivos(activos);
      setOrdenTrabajos(ordenarTrabajosPorPrioridad(activos).map((t: any) => t.id));
      setTrabajosFinalizados(finalizados);
    }
    if (dataFinanzas) setFinanzas(dataFinanzas);
    if (dataHistorial) setHistorial(dataHistorial);
    if (dataCatastro && dataCatastro.length > 0) setCatastro({
      usuario: dataCatastro[0].usuario,
      fecha: dataCatastro[0].fecha_actualizacion,
      liberadoPor: dataCatastro[0].liberado_por || "",
      fechaLiberacion: dataCatastro[0].fecha_liberacion || ""
    });
  };

  const enviarTelegram = async (mensaje: string, fotoUrl?: string) => {
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) return;
      await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ mensaje, fotoUrl })
      });
    } catch (error) { console.error(error); }
  };

  // Quién está usando la app, según la sesión iniciada.
  const miNombre = NOMBRE_POR_EMAIL[session?.user?.email || ""] || session?.user?.email || "";

  const tomarCatastro = async (nombre: string) => {
    const nuevaFecha = new Date().toISOString();
    await supabase.from("estado_catastro").update({ usuario: nombre, fecha_actualizacion: nuevaFecha }).eq("id", 1);
    cargarDatos();
    await enviarTelegram(`🔴 *SISTEMA EN USO*\n\n**${nombre}** acaba de entrar al sistema SCIT de Catastro.`);
  };

  const liberarCatastro = async () => {
    // Se puede liberar aunque figure a nombre del otro (por ejemplo si se olvidó de hacerlo), pero se confirma.
    const delOtro = catastro.usuario !== "Libre" && catastro.usuario !== miNombre;
    if (delOtro && !confirm(`El SCIT figura en uso por ${catastro.usuario}. ¿Liberarlo igual?`)) return;
    const ahora = new Date().toISOString();
    await supabase.from("estado_catastro").update({
      usuario: "Libre",
      fecha_actualizacion: ahora,
      liberado_por: miNombre,
      fecha_liberacion: ahora
    }).eq("id", 1);
    cargarDatos();
    await enviarTelegram(`🟢 *SISTEMA LIBERADO*\n\nEl sistema SCIT ya está disponible nuevamente.${delOtro ? `\n(Lo liberó ${miNombre}; figuraba a nombre de ${catastro.usuario}.)` : ""}`);
  };

  const formatearPlata = (monto: any) => new Intl.NumberFormat("es-AR").format(Number(monto));
  const handlePlataInput = (campo: string, valorStr: string) => { const valorLimpio = valorStr.replace(/\D/g, ''); setNuevaFinanza({ ...nuevaFinanza, [campo]: Number(valorLimpio) }); };
  
  const actualizarValoresFinanza = (campo: string, valor: string) => {
    const siguiente: any = { ...nuevaFinanza, [campo]: valor };
    // Al cargar un expediente nuevo, el título y el SET se sugieren solos en los REP (y no en un saldo).
    if (campo === 'tramite' && !editandoFinanzaId && nuevaFinanza.tipoPago === "entrega") { const esREP = valor.toUpperCase().includes("REP"); siguiente.cantTitulo = esREP ? 1 : 0; siguiente.cantSet = esREP ? 1 : 0; }
    setNuevaFinanza(siguiente);
  };

  const cambiarTipoPago = (tipoPago: "entrega" | "saldo" | "gastos") => {
    // Un registro de gastos no lleva ingreso: arranca todo en $0 y se completa a mano.
    setNuevaFinanza({ ...nuevaFinanza, tipoPago, ingreso: tipoPago === "gastos" ? 0 : nuevaFinanza.ingreso, ...valoresFinanzaPorDefecto(nuevaFinanza.tramite, tipoPago) });
  };

  const ajustarCantidad = (campo: "cantCert" | "cantTitulo" | "cantSet", delta: number) => {
    setNuevaFinanza({ ...nuevaFinanza, [campo]: Math.max(0, Math.min(20, nuevaFinanza[campo] + delta)) });
  };

  const toggleGasto5050 = () => {
    if (!nuevaFinanza.esGasto5050) setNuevaFinanza({ ...nuevaFinanza, esGasto5050: true, tipoPago: "entrega", tramite: "Cuota CAJA", ingreso: 0, caja: 0, colegio: 0, cantCert: 0, cantTitulo: 0, cantSet: 0, extraLeo: 0, extraBruno: 0, propietario: "-" });
    else setNuevaFinanza({ ...estadoFinanzaInicial, encargado: nuevaFinanza.encargado });
  };

  // Un contador de gasto (certificado, título o SET) con botones − / +.
  const renderContadorGasto = (titulo: string, detalle: string, unitario: number, campo: "cantCert" | "cantTitulo" | "cantSet", paga: string) => {
    const cantidad = nuevaFinanza[campo];
    return (
      <div className="bg-[#222222] rounded p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider font-bold text-zinc-300">{titulo}</div>
          <div className="text-[10px] text-zinc-500">{detalle} · paga {paga}</div>
          <div className="text-sm font-black text-white mt-1">${formatearPlata(unitario * cantidad)}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => ajustarCantidad(campo, -1)} disabled={cantidad <= 0} className="w-9 h-9 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-lg font-black text-white" title="Quitar uno">−</button>
          <span className="w-6 text-center font-black text-white">{cantidad}</span>
          <button type="button" onClick={() => ajustarCantidad(campo, 1)} className="w-9 h-9 rounded bg-zinc-800 hover:bg-zinc-700 text-lg font-black text-white" title="Agregar uno">+</button>
        </div>
      </div>
    );
  };

  const parsearCoordenadasPegadas = (texto: string) => {
    const regex = /(-?\d+\.\d+),\s*(-?\d+\.\d+)/;
    const match = texto.match(regex);
    if (match) {
      return { lat: match[1], lng: match[2] };
    }
    return null;
  };

  // Caja que abarca Santa Fe capital y Santo Tomé (con margen) para priorizar resultados de la zona
  const VIEWBOX_SANTA_FE_SANTO_TOME = "-60.90,-31.55,-60.55,-31.75";

  const buscarDireccionNominatim = (query: string) => {
    setNuevoTrabajo({ ...nuevoTrabajo, ubicacion: query });

    if (debounceDireccionRef.current) clearTimeout(debounceDireccionRef.current);

    const coordsDetectadas = parsearCoordenadasPegadas(query);
    if (coordsDetectadas) {
      setNuevoTrabajo(prev => ({
        ...prev,
        ubicacion: query,
        lat: coordsDetectadas.lat,
        lng: coordsDetectadas.lng
      }));
      setSugerenciasDireccion([]);
      return;
    }

    if (query.length < 3) { setSugerenciasDireccion([]); setBuscandoDireccion(false); return; }

    setBuscandoDireccion(true);
    debounceDireccionRef.current = setTimeout(async () => {
      const idBusqueda = ++idBusquedaDireccionRef.current;
      try {
        const buscarCon = (bounded: boolean) =>
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ar&viewbox=${VIEWBOX_SANTA_FE_SANTO_TOME}${bounded ? "&bounded=1" : ""}&limit=6`)
            .then(res => res.json());

        let data = await buscarCon(true);
        if (!data || data.length === 0) {
          data = await buscarCon(false);
        }

        if (idBusqueda === idBusquedaDireccionRef.current) {
          setSugerenciasDireccion(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (idBusqueda === idBusquedaDireccionRef.current) setBuscandoDireccion(false);
      }
    }, 400);
  };

  const seleccionarSugerencia = (item: any) => {
    setNuevoTrabajo({
      ...nuevoTrabajo,
      ubicacion: item.display_name,
      lat: item.lat,
      lng: item.lon
    });
    setSugerenciasDireccion([]);
  };

  const formatearPartidaInput = (valorCrudo: string) => {
    const val = valorCrudo.replace(/\D/g, "").substring(0, 16);
    let formatted = "";
    if (val.length > 0) formatted += val.slice(0, 2);
    if (val.length > 2) formatted += "-" + val.slice(2, 4);
    if (val.length > 4) formatted += "-" + val.slice(4, 6);
    if (val.length > 6) formatted += " " + val.slice(6, 12);
    if (val.length > 12) formatted += "/" + val.slice(12, 16);
    return formatted;
  };

  // Parsea el HTML de respuesta del SCIT para sacar la ubicación y el
  // id de parcela de 15 dígitos (distrito+sección+manzana+parcela).
  const parsearHTMLCatastro = (html: string) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const result: any = { generales: {}, parcelas: [] as any[] };

    doc.querySelectorAll("table").forEach((table) => {
      const textoTabla = table.textContent || "";
      const filas = Array.from(table.querySelectorAll("tbody tr"));
      if (!filas.length) return;

      if (/DATOS GENERALES DE LA PARTIDA/i.test(textoTabla)) {
        let dataRow = filas[0];
        for (const f of filas) {
          if (f.children[0] && /^\d{2}-\d{2}-\d{2}/.test(f.children[0].textContent?.trim() || "")) { dataRow = f; break; }
        }
        const val = Array.from(dataRow.children).map((c) => c.textContent?.trim() || "");
        ["Partida", "Estado", "Ubicación", "Zona", "Sup. Terreno", "Sup. Edificación"].forEach((k, i) => { result.generales[k] = val[i] || ""; });
      }

      if (/DATOS DE PARCELAS POR PARTIDA/i.test(textoTabla)) {
        filas.forEach((fila) => {
          const val = Array.from(fila.children).map((c) => c.textContent?.trim() || "");
          const rawParcela = val[0] ? val[0].replace(/[^a-zA-Z0-9]/g, "") : "";
          if (rawParcela.length >= 15) {
            result.parcelas.push({ parcela: val[0], base15: rawParcela.substring(0, 15) });
          }
        });
      }
    });

    return result;
  };

  const buscarUbicacionPorPartida = async () => {
    const digitos = partidaInput.replace(/\D/g, "");
    if (digitos.length < 16) { setErrorPartida("Ingresá la partida completa (16 dígitos)."); return; }

    setErrorPartida("");
    setBuscandoPartida(true);
    try {
      const respPartida = await fetch(`/api/partida?partida=${encodeURIComponent(digitos)}`);
      const rawData = await respPartida.json();
      if (!respPartida.ok || !rawData.html) throw new Error(rawData.error || "No se pudo consultar la partida.");
      if (rawData.html.includes("La partida no existe")) throw new Error("La partida no existe en los registros del SCIT.");

      const data = parsearHTMLCatastro(rawData.html);
      if (data.parcelas.length === 0 || !data.parcelas[0].base15) throw new Error("No se encontró la parcela asociada a esa partida.");

      const idParcela15 = data.parcelas[0].base15;
      const respCoords = await fetch(`/api/coordenadas?idParcela=${idParcela15}`);
      const dataCoords = await respCoords.json();
      if (!respCoords.ok) throw new Error(dataCoords.error || "No se pudo obtener la ubicación de la parcela.");

      let lat: number | undefined, lng: number | undefined;
      if (dataCoords.centro && Array.isArray(dataCoords.centro) && dataCoords.centro.length === 2) {
        lat = parseFloat(dataCoords.centro[0]);
        lng = parseFloat(dataCoords.centro[1]);
      } else if (dataCoords.extent && Array.isArray(dataCoords.extent) && dataCoords.extent.length === 4) {
        const [n1, n2, n3, n4] = dataCoords.extent.map((n: any) => parseFloat(n));
        if (n1 > -40 && n1 < -20) { lat = (n1 + n3) / 2; lng = (n2 + n4) / 2; } else { lng = (n1 + n3) / 2; lat = (n2 + n4) / 2; }
      }

      if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) throw new Error("IDESF no devolvió coordenadas válidas.");

      // Siempre se carga el centro de la parcela como coordenadas: es lo más exacto
      // y es lo que recibe Google Calendar como lugar de la medición.
      const ubicacionTexto = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setNuevoTrabajo((prev) => ({ ...prev, ubicacion: ubicacionTexto, lat: String(lat), lng: String(lng) }));
      setSugerenciasDireccion([]);
    } catch (err: any) {
      setErrorPartida(err.message || "Error al buscar la partida.");
    } finally {
      setBuscandoPartida(false);
    }
  };

  const guardarTrabajo = async (e: any) => {
    e.preventDefault();
    const datosGuardar: any = {
      tipo: nuevoTrabajo.tipo,
      propietario: nuevoTrabajo.propietario,
      nombre_expediente: `${nuevoTrabajo.tipo} - ${nuevoTrabajo.propietario}`, 
      estado_detalle: nuevoTrabajo.estado,
      color_alerta: nuevoTrabajo.color,
      encargado: nuevoTrabajo.encargado,
      finalizado: false
    };

    if (nuevoTrabajo.ubicacion) datosGuardar.ubicacion = nuevoTrabajo.ubicacion;
    if (nuevoTrabajo.lat) datosGuardar.lat = Number(nuevoTrabajo.lat);
    if (nuevoTrabajo.lng) datosGuardar.lng = Number(nuevoTrabajo.lng);

    if (editandoTrabajoId) {
      const { error } = await supabase.from("trabajos_curso").update(datosGuardar).eq("id", editandoTrabajoId);
      if (error) { alert(`Error al actualizar: ${error.message}`); return; }
      setEditandoTrabajoId(null);
    } else {
      const { error } = await supabase.from("trabajos_curso").insert([datosGuardar]);
      if (error) { alert(`Error al guardar: ${error.message}`); return; }
    }
    
    setNuevoTrabajo({ tipo: "", propietario: "", estado: "", color: "verde", encargado: "Leo", ubicacion: "", lat: "", lng: "" });
    setPartidaInput("");
    setErrorPartida("");
    cargarDatos();
  };

  const iniciarEdicionTrabajo = (t: any) => {
    setEditandoTrabajoId(t.id);
    setNuevoTrabajo({ 
      tipo: t.tipo || "", 
      propietario: t.propietario || t.nombre_expediente || "", 
      estado: t.estado_detalle || "", 
      color: t.color_alerta || "verde", 
      encargado: t.encargado || "Leo",
      ubicacion: t.ubicacion || "",
      lat: t.lat ? String(t.lat) : "",
      lng: t.lng ? String(t.lng) : ""
    });
    if (t.encargado === "Leo") setLeoAbierto(true);
    if (t.encargado === "Bruno") setBrunoAbierto(true);
    
    setTimeout(() => {
      notasInputRef.current?.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const guardarNotaInline = async (t: any) => {
    const actual = notaEditandoRef.current;
    if (!actual || actual.id !== t.id) return;
    const nueva = actual.valor.trim();
    editarNota(null);
    if (nueva === (t.estado_detalle || "")) return;
    setTrabajosActivos(prev => prev.map(x => x.id === t.id ? { ...x, estado_detalle: nueva } : x));
    const { error } = await supabase.from("trabajos_curso").update({ estado_detalle: nueva }).eq("id", t.id);
    if (error) {
      setTrabajosActivos(prev => prev.map(x => x.id === t.id ? { ...x, estado_detalle: t.estado_detalle } : x));
      alert(`No se pudo guardar la nota: ${error.message}`);
    }
  };

  const toggleEtapa = async (id: string, etapa: string, valorActual: boolean) => {
    setTrabajosActivos(prev => prev.map(t => t.id === id ? { ...t, [etapa]: !valorActual } : t));
    await supabase.from("trabajos_curso").update({ [etapa]: !valorActual }).eq("id", id);
  };

  const ciclarEtapaMultifase = async (t: any, id: string) => {
    const columnas = ETAPAS_MULTIFASE[id].columnas;
    const fase = (faseEtapa(t, id) + 1) % (columnas.length + 1);
    const cambios = Object.fromEntries(columnas.map((c, i) => [c, i < fase]));
    setTrabajosActivos(prev => prev.map(x => x.id === t.id ? { ...x, ...cambios } : x));
    await supabase.from("trabajos_curso").update(cambios).eq("id", t.id);
  };

  const toggleEstadoIngresado = async (t: any) => {
    const nuevoColor = t.color_alerta === 'amarillo' ? 'verde' : 'amarillo';
    setTrabajosActivos(prev => prev.map(x => x.id === t.id ? { ...x, color_alerta: nuevoColor } : x));
    const { error } = await supabase.from("trabajos_curso").update({ color_alerta: nuevoColor }).eq("id", t.id);
    if (error) setTrabajosActivos(prev => prev.map(x => x.id === t.id ? { ...x, color_alerta: t.color_alerta } : x));
  };

  const guardarEdicionRapidaDash = async (e: any) => {
    e.preventDefault();
    if (!trabajoEditandoDash) return;
    
    const { error } = await supabase.from("trabajos_curso").update({
      tipo: trabajoEditandoDash.tipo,
      propietario: trabajoEditandoDash.propietario,
      nombre_expediente: `${trabajoEditandoDash.tipo} - ${trabajoEditandoDash.propietario}`,
      encargado: trabajoEditandoDash.encargado,
      fecha_finalizacion: trabajoEditandoDash.fecha_finalizacion,
      ubicacion: (trabajoEditandoDash.ubicacion || "").trim() || null,
      lat: aNumeroONull(trabajoEditandoDash.lat),
      lng: aNumeroONull(trabajoEditandoDash.lng)
    }).eq("id", trabajoEditandoDash.id);

    if (error) {
      alert(`Error al actualizar: ${error.message}`);
    } else {
      cerrarModalEdicionDash();
      cargarDatos();
    }
  };

  const cerrarModalEdicionDash = () => {
    setTrabajoEditandoDash(null);
    setSugerenciasModal([]);
    setMensajeUbicacionModal("");
  };

  // Ubicación en el formulario de edición: acepta coordenadas pegadas o una dirección.
  const buscarUbicacionModal = async () => {
    const texto = (trabajoEditandoDash?.ubicacion || "").trim();
    if (!texto) return;
    setMensajeUbicacionModal("");
    const coords = parsearCoordenadasPegadas(texto);
    if (coords) {
      setTrabajoEditandoDash((prev: any) => ({ ...prev, lat: coords.lat, lng: coords.lng }));
      setSugerenciasModal([]);
      setMensajeUbicacionModal("Coordenadas aplicadas.");
      return;
    }
    setBuscandoModal(true);
    try {
      const buscarCon = (bounded: boolean) =>
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(texto)}&countrycodes=ar&viewbox=${VIEWBOX_SANTA_FE_SANTO_TOME}${bounded ? "&bounded=1" : ""}&limit=6`)
          .then(res => res.json());
      let data = await buscarCon(true);
      if (!data || data.length === 0) data = await buscarCon(false);
      setSugerenciasModal(data || []);
      if (!data || data.length === 0) setMensajeUbicacionModal("No se encontró esa dirección.");
    } catch {
      setMensajeUbicacionModal("No se pudo buscar. Probá de nuevo.");
    } finally {
      setBuscandoModal(false);
    }
  };

  const elegirSugerenciaModal = (item: any) => {
    setTrabajoEditandoDash((prev: any) => ({ ...prev, ubicacion: item.display_name, lat: item.lat, lng: item.lon }));
    setSugerenciasModal([]);
  };

  // Al arrastrar un pin en el mapa: se pide confirmación y se guarda la nueva posición.
  const moverPinTrabajo = async (t: any, lat: number, lng: number, revertir: () => void) => {
    const nombre = t.propietario || t.nombre_expediente;
    const coordsTexto = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    if (!confirm(`¿Mover el pin de ${nombre} a esta nueva ubicación?\n\n${coordsTexto}`)) { revertir(); return; }
    const textoActual = (t.ubicacion || "").trim();
    const textoEsCoordenadas = /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(textoActual);
    const cambios = { lat, lng, ubicacion: !textoActual || textoEsCoordenadas ? coordsTexto : t.ubicacion };
    const { error } = await supabase.from("trabajos_curso").update(cambios).eq("id", t.id);
    if (error) { revertir(); alert(`No se pudo mover el pin: ${error.message}`); return; }
    setTrabajosFinalizados(prev => prev.map(x => x.id === t.id ? { ...x, ...cambios } : x));
  };

  useEffect(() => { moverPinRef.current = moverPinTrabajo; });

  const finalizarTrabajo = async (t: any) => {
    const nombreMostrar = t.tipo ? `${t.tipo} de ${t.propietario}` : t.nombre_expediente;
    if (confirm(`¿Marcar el expediente "${nombreMostrar}" como FINALIZADO y enviarlo al historial y mapa?`)) {
      await supabase.from("trabajos_curso").update({ 
        finalizado: true, 
        fecha_finalizacion: new Date().toISOString().split('T')[0] 
      }).eq("id", t.id);
      cargarDatos();
    }
  };

  const eliminarTrabajo = async (id: string) => {
    if (confirm("🚨 ATENCIÓN: ¿Estás seguro de borrar DEFINITIVAMENTE este expediente? Esta acción no se puede deshacer.")) {
      await supabase.from("trabajos_curso").delete().eq("id", id);
      cargarDatos();
    }
  };

  const generarLinkCalendarExpediente = (t: any) => {
    const titulo = `Medición / Coordinación: ${t.tipo || 'Trámite'} - ${t.propietario || t.nombre_expediente}`;
    const fechaManana = new Date();
    fechaManana.setDate(fechaManana.getDate() + 1);
    fechaManana.setHours(14, 0, 0, 0);
    
    const fechaInicio = fechaManana;
    const fechaFin = new Date(fechaInicio.getTime() + (2 * 60 * 60 * 1000));
    const f = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
    
    const invitados = "leandroscolari14@gmail.com,brunoverga13@gmail.com";
    const ubicacion = t.ubicacion || "Santa Fe, Argentina";
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${f(fechaInicio)}/${f(fechaFin)}&location=${encodeURIComponent(ubicacion)}&details=${encodeURIComponent(`Medición coordinada para expediente de agrimensura.`)}&add=${invitados}`;
  };

  const guardarFinanza = async (e: any) => {
    e.preventDefault();
    const extras = calcularExtras(nuevaFinanza.encargado, nuevaFinanza.cantCert, nuevaFinanza.cantTitulo, nuevaFinanza.cantSet, nuevaFinanza.extraLeo, nuevaFinanza.extraBruno);
    const conCantidades = !nuevaFinanza.esGasto5050;
    if (nuevaFinanza.tipoPago === "gastos" && !nuevaFinanza.esGasto5050 && nuevaFinanza.caja + nuevaFinanza.colegio + extras.extraLeo + extras.extraBruno === 0) {
      alert("Cargá al menos un gasto (aportes, certificado, título, SET o extras).");
      return;
    }
    const datosGuardar = {
      tipo_tramite: nuevaFinanza.tramite, propietario: nuevaFinanza.propietario, encargado: nuevaFinanza.encargado, ingreso_total: nuevaFinanza.ingreso,
      caja: nuevaFinanza.caja, colegio: nuevaFinanza.colegio, extra_leo: extras.extraLeo, extra_bruno: extras.extraBruno, es_gasto_5050: nuevaFinanza.esGasto5050,
      tipo_pago: nuevaFinanza.esGasto5050 ? null : nuevaFinanza.tipoPago,
      cant_certificado: conCantidades ? nuevaFinanza.cantCert : null,
      cant_titulo: conCantidades ? nuevaFinanza.cantTitulo : null,
      cant_set: conCantidades ? nuevaFinanza.cantSet : null,
      cant_titulo_set: null
    };
    const { error } = editandoFinanzaId
      ? await supabase.from("finanzas").update(datosGuardar).eq("id", editandoFinanzaId)
      : await supabase.from("finanzas").insert([datosGuardar]);
    if (error) { alert(`No se pudo guardar el registro: ${error.message}`); return; }
    setEditandoFinanzaId(null);
    setNuevaFinanza(estadoFinanzaInicial);
    cargarDatos();
    setTimeout(() => { tipoInputRef.current?.focus(); }, 100);
  };
  const iniciarEdicionFinanza = (f: any) => {
    const extraLeo = Number(f.extra_leo || 0), extraBruno = Number(f.extra_bruno || 0);
    const gastos = f.es_gasto_5050 ? { certificado: 0, titulo: 0, set: 0, extraLeo: 0, extraBruno: 0 } : derivarGastos(f);
    const sinGastos = Number(f.caja) === 0 && Number(f.colegio) === 0 && extraLeo === 0 && extraBruno === 0;
    setEditandoFinanzaId(f.id);
    setNuevaFinanza({ tramite: f.tipo_tramite, propietario: f.propietario, encargado: f.encargado, ingreso: Number(f.ingreso_total), caja: Number(f.caja), colegio: Number(f.colegio), tipoPago: f.tipo_pago || (sinGastos ? "saldo" : "entrega"), cantCert: gastos.certificado, cantTitulo: gastos.titulo, cantSet: gastos.set, extraLeo: gastos.extraLeo, extraBruno: gastos.extraBruno, esGasto5050: f.es_gasto_5050 || false });
  };
  const eliminarFinanza = async (id: string) => { if (confirm("¿Borrar registro?")) { await supabase.from("finanzas").delete().eq("id", id); cargarDatos(); } };
  
  const liquidarSemana = async () => {
    if (finanzas.length === 0) return alert("Nada para liquidar.");
    if (!confirm("¿Estás seguro de cerrar y liquidar esta semana?")) return;

    let urlComprobanteFinal = null;
    if (archivoComprobante) {
      const nombreArchivo = `${Date.now()}_${archivoComprobante.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from("comprobantes").upload(nombreArchivo, archivoComprobante);
      if (uploadError) { alert(`Error al subir el comprobante: ${uploadError.message}`); return; }
      const { data: publicUrlData } = supabase.storage.from("comprobantes").getPublicUrl(nombreArchivo);
      urlComprobanteFinal = publicUrlData.publicUrl;
    }

    // Si la semana fue reabierta, sus registros conservan la fecha de liquidación original: se reutiliza.
    const fechaOriginal = finanzas.find((f: any) => f.fecha_liquidacion)?.fecha_liquidacion;
    const datosLiquidar: any = { liquidado: true, fecha_liquidacion: fechaOriginal || new Date().toISOString() };
    if (urlComprobanteFinal) datosLiquidar.comprobante_url = urlComprobanteFinal;
    const ids = finanzas.map((f: any) => f.id);
    const { error } = await supabase.from("finanzas").update(datosLiquidar).in("id", ids);

    if (error) { alert(`Error al liquidar: ${error.message}`); return; }

    const resumen = generarResumen(finanzas);
    let msg = `💰 *CIERRE DE SEMANA LIQUIDADO*\n\n`;
    msg += `• *Leo Limpio:* $${formatearPlata(resumen.limpioLeoTotal)} (${resumen.balanceLeo > 0 ? `Transfirió $${formatearPlata(resumen.balanceLeo)}` : `Recibió $${formatearPlata(Math.abs(resumen.balanceLeo))}`})\n`;
    msg += `• *Bruno Limpio:* $${formatearPlata(resumen.limpioBrunoTotal)} (${resumen.balanceBruno > 0 ? `Transfirió $${formatearPlata(resumen.balanceBruno)}` : `Recibió $${formatearPlata(Math.abs(resumen.balanceBruno))}`})\n`;
    if (urlComprobanteFinal) { msg += `\n📎 *Comprobante de transferencia adjunto.*`; }

    await enviarTelegram(msg, urlComprobanteFinal || undefined);
    setArchivoComprobante(null);
    cargarDatos();
    alert("¡Semana liquidada y respaldada con éxito!");
  };

  const cargarRevisionesPlanos = async () => {
    const { data } = await supabase.from("revisiones_planos").select("*").order("creado_en", { ascending: false });
    if (data) setRevisionesPlanos(data);
    setRevisionesPlanosCargadas(true);
  };

  const revisarPlano = async () => {
    if (!archivoPlano) { setErrorPlano("Seleccioná un archivo PDF primero."); return; }
    setErrorPlano("");
    setRevisandoPlano(true);
    setResultadoPlanoActual(null);
    try {
      // Vercel limita el envío a 4,5 MB en total; se avisa antes de mandar.
      const pesoTotal = [archivoPlano, archivoEscritura, archivoSet].reduce((suma, a) => suma + (a?.size || 0), 0);
      if (pesoTotal > 4.2 * 1024 * 1024) throw new Error(`Los archivos pesan ${(pesoTotal / 1024 / 1024).toFixed(1)} MB y el máximo es 4 MB en total. Usá versiones más livianas o solo las hojas necesarias de la escritura.`);

      const { data: dataSesion } = await supabase.auth.getSession();
      const accessToken = dataSesion.session?.access_token;
      if (!accessToken) throw new Error("La sesión venció. Volvé a iniciar sesión.");

      const formData = new FormData();
      formData.append("archivo", archivoPlano);
      if (archivoEscritura) formData.append("escritura", archivoEscritura);
      if (archivoSet) formData.append("set", archivoSet);
      const respAnalisis = await fetch("/api/revisar-plano", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: formData });
      const resultado = await respAnalisis.json().catch(() => ({ error: respAnalisis.status === 413 ? "Los archivos son demasiado pesados." : "No se pudo analizar el plano." }));
      if (!respAnalisis.ok) throw new Error(resultado.error || "No se pudo analizar el plano.");

      const nombreArchivo = `${Date.now()}_${archivoPlano.name}`;
      const { error: uploadError } = await supabase.storage.from("planos").upload(nombreArchivo, archivoPlano);
      if (uploadError) throw new Error(`Se analizó el plano pero no se pudo guardar el archivo: ${uploadError.message}`);
      const { data: publicUrlData } = supabase.storage.from("planos").getPublicUrl(nombreArchivo);

      const datosGuardar = {
        expediente_id: expedientePlano || null,
        nombre_archivo: archivoPlano.name,
        archivo_url: publicUrlData.publicUrl,
        revisor: session.user.email,
        resultado,
      };
      const { error: insertError } = await supabase.from("revisiones_planos").insert([datosGuardar]);
      if (insertError) throw new Error(`Se analizó el plano pero no se pudo guardar el historial: ${insertError.message}`);

      setResultadoPlanoActual(resultado);
      setArchivoPlano(null);
      setArchivoEscritura(null);
      setArchivoSet(null);
      setClaveArchivosPlano(k => k + 1);
      setExpedientePlano("");
      await cargarRevisionesPlanos();
    } catch (err: any) {
      setErrorPlano(err.message || "Error al revisar el plano.");
    } finally {
      setRevisandoPlano(false);
    }
  };

  const reabrirSemana = async (fechaKey: string) => { if (finanzas.length > 0) return alert("Liquidá la actual primero."); if (confirm("¿Reabrir?")) { if (fechaKey === "anterior") await supabase.from("finanzas").update({ liquidado: false }).is("fecha_liquidacion", null).eq("liquidado", true); else await supabase.from("finanzas").update({ liquidado: false }).eq("fecha_liquidacion", fechaKey); await cargarDatos(); setSubTabFinanzas("actual"); } };
  const eliminarSemana = async (fechaKey: string) => { if (confirm("¿Borrar historial?")) { if (fechaKey === "anterior") await supabase.from("finanzas").delete().is("fecha_liquidacion", null).eq("liquidado", true); else await supabase.from("finanzas").delete().eq("fecha_liquidacion", fechaKey); cargarDatos(); } };

  const calcularPartes = (f: any) => {
    if (f.es_gasto_5050) return { totalAportes: Number(f.caja), limpioLeo: 0, limpioBruno: 0 };
    const totalAportes = Number(f.caja) + Number(f.colegio) + Number(f.extra_leo || 0) + Number(f.extra_bruno || 0);
    const limpio = Number(f.ingreso_total) - totalAportes;
    return { totalAportes: Math.round(totalAportes), limpioLeo: Math.round(f.encargado === "Leo" ? limpio * 0.70 : limpio * 0.30), limpioBruno: Math.round(f.encargado === "Bruno" ? limpio * 0.70 : limpio * 0.30) };
  };

  const generarResumen = (lista: any[]) => {
    let cobradoLeo = 0, cobradoBruno = 0, gastosSalientesLeo = 0, gastosSalientesBruno = 0, gananciaPuraLeo = 0, gananciaPuraBruno = 0, deuda5050Leo = 0, deuda5050Bruno = 0;
    lista.forEach((f: any) => {
      if (f.es_gasto_5050) { const gasto = Number(f.caja); deuda5050Leo += gasto / 2; deuda5050Bruno += gasto / 2; if (f.encargado === "Leo") gastosSalientesLeo += gasto; else gastosSalientesBruno += gasto; } 
      else {
        const partes = calcularPartes(f);
        gananciaPuraLeo += partes.limpioLeo; gananciaPuraBruno += partes.limpioBruno;
        // El ingreso lo cobra quien cargó el expediente, y los aportes también los paga él. Los gastos extra
        // se le cuentan a quien los pagó (extra_leo a Leo, extra_bruno a Bruno), aunque el trabajo sea del otro.
        const aportes = Number(f.caja) + Number(f.colegio);
        gastosSalientesLeo += Number(f.extra_leo || 0) + (f.encargado === "Leo" ? aportes : 0);
        gastosSalientesBruno += Number(f.extra_bruno || 0) + (f.encargado === "Bruno" ? aportes : 0);
        if (f.encargado === "Leo") cobradoLeo += Number(f.ingreso_total); else cobradoBruno += Number(f.ingreso_total);
      }
    });
    // El limpio de cada uno descuenta todos los gastos: los del trámite (ya restados en cada expediente) y la mitad de los gastos 50/50.
    const limpioLeoNeto = gananciaPuraLeo - deuda5050Leo;
    const limpioBrunoNeto = gananciaPuraBruno - deuda5050Bruno;
    return { cobradoLeo, limpioLeoTotal: Math.round(limpioLeoNeto), gastosLeo: gastosSalientesLeo, balanceLeo: (cobradoLeo - gastosSalientesLeo) - limpioLeoNeto, cobradoBruno, limpioBrunoTotal: Math.round(limpioBrunoNeto), gastosBruno: gastosSalientesBruno, balanceBruno: (cobradoBruno - gastosSalientesBruno) - limpioBrunoNeto };
  };

  const resumenActual = generarResumen(finanzas);
  const trabajosLeo = ordenarSegunIds(trabajosActivos.filter((t: any) => t.encargado === "Leo"), ordenTrabajos);
  const trabajosBruno = ordenarSegunIds(trabajosActivos.filter((t: any) => t.encargado === "Bruno"), ordenTrabajos);

  const trabajosFiltrados = trabajosFinalizados.filter((t: any) => {
    const coincideEncargado = filtroEncargado === "Todos" || t.encargado === filtroEncargado;
    const coincideTipo = filtroTipo === "" || (t.tipo && t.tipo.toLowerCase().includes(filtroTipo.toLowerCase()));
    const searchStr = `${t.tipo || ''} ${t.propietario || ''} ${t.nombre_expediente || ''}`.toLowerCase();
    const coincideTexto = searchStr.includes(filtroTexto.toLowerCase());
    return coincideEncargado && coincideTipo && coincideTexto;
  });

  const trabajosPorAnioYMes = trabajosFiltrados.reduce((acc: any, t: any) => {
    const anio = t.fecha_finalizacion ? t.fecha_finalizacion.substring(0, 4) : "Sin Fecha";
    const mesNum = t.fecha_finalizacion ? t.fecha_finalizacion.substring(5, 7) : "00";
    if (!acc[anio]) acc[anio] = {};
    if (!acc[anio][mesNum]) acc[anio][mesNum] = [];
    acc[anio][mesNum].push(t);
    return acc;
  }, {});

  Object.keys(trabajosPorAnioYMes).forEach(anio => {
    Object.keys(trabajosPorAnioYMes[anio]).forEach(mesNum => {
      trabajosPorAnioYMes[anio][mesNum].sort((a: any, b: any) => {
        const propA = (a.propietario || a.nombre_expediente || "").toLowerCase();
        const propB = (b.propietario || b.nombre_expediente || "").toLowerCase();
        return propA.localeCompare(propB);
      });
    });
  });

  const aniosOrdenados = Object.keys(trabajosPorAnioYMes).sort((a, b) => b.localeCompare(a));
  const toggleAnio = (anio: string) => setAniosAbiertos({ ...aniosAbiertos, [anio]: !aniosAbiertos[anio] });
  const toggleMes = (key: string) => setMesesAbiertos({ ...mesesAbiertos, [key]: !mesesAbiertos[key] });

  const nombresMeses: Record<string, string> = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril", "05": "Mayo", "06": "Junio",
    "07": "Julio", "08": "Agosto", "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre", "00": "Sin Fecha"
  };

  const agruparHistorial = (lista: any[]) => {
    const agrupado = lista.reduce((acc: any, item: any) => {
      const fechaLiq = item.fecha_liquidacion;
      const anio = fechaLiq ? fechaLiq.substring(0, 4) : "Sin Fecha";
      const mesNum = fechaLiq ? fechaLiq.substring(5, 7) : "00";

      if (!acc[anio]) acc[anio] = {};
      if (!acc[anio][mesNum]) acc[anio][mesNum] = {};

      const semanaKey = fechaLiq || "anterior";
      if (!acc[anio][mesNum][semanaKey]) acc[anio][mesNum][semanaKey] = [];
      acc[anio][mesNum][semanaKey].push(item);
      return acc;
    }, {});

    Object.keys(agrupado).forEach(anio => {
      Object.keys(agrupado[anio]).forEach(mesNum => {
        Object.keys(agrupado[anio][mesNum]).forEach(semanaKey => {
          agrupado[anio][mesNum][semanaKey].sort((a: any, b: any) => {
            const propA = (a.propietario || a.tipo_tramite || "").toLowerCase();
            const propB = (b.propietario || b.tipo_tramite || "").toLowerCase();
            return propA.localeCompare(propB);
          });
        });
      });
    });
    return agrupado;
  };

  const historialAgrupado = agruparHistorial(historial);

  const buscandoHistorial = busquedaHistorial.trim() !== "";
  const palabrasHistorial = normalizarTexto(busquedaHistorial).split(/\s+/).filter(Boolean);
  const coincideHistorial = (h: any) => {
    const propietario = normalizarTexto(h.propietario || "");
    return palabrasHistorial.every(p => propietario.includes(p));
  };
  const historialCoincidencias = buscandoHistorial ? historial.filter(coincideHistorial) : historial;
  const historialVisible = buscandoHistorial ? agruparHistorial(historialCoincidencias) : historialAgrupado;
  const ingresosCoincidencias = historialCoincidencias.filter((h: any) => !h.es_gasto_5050 && h.tipo_pago !== "gastos");
  const entregadoBusqueda = ingresosCoincidencias.reduce((suma: number, h: any) => suma + Number(h.ingreso_total || 0), 0);
  const entregadoPorPropietario = Object.values(ingresosCoincidencias.reduce((acc: Record<string, { nombre: string; total: number }>, h: any) => {
    const clave = normalizarTexto(h.propietario || "").trim();
    acc[clave] = { nombre: acc[clave]?.nombre || h.propietario, total: (acc[clave]?.total || 0) + Number(h.ingreso_total || 0) };
    return acc;
  }, {})).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const semanaActualCoincidencias = buscandoHistorial ? finanzas.filter((f: any) => !f.es_gasto_5050 && f.tipo_pago !== "gastos" && coincideHistorial(f)) : [];
  const entregadoSemanaActual = semanaActualCoincidencias.reduce((suma: number, f: any) => suma + Number(f.ingreso_total || 0), 0);

  const aniosFinanzasOrdenados = Object.keys(historialVisible).sort((a, b) => {
    if (a === "Sin Fecha") return 1;
    if (b === "Sin Fecha") return -1;
    return b.localeCompare(a);
  });

  const toggleAnioFinanzas = (anio: string) => setAniosFinanzasAbiertos({ ...aniosFinanzasAbiertos, [anio]: !aniosFinanzasAbiertos[anio] });
  const toggleMesFinanzas = (key: string) => setMesesFinanzasAbiertos({ ...mesesFinanzasAbiertos, [key]: !mesesFinanzasAbiertos[key] });
  const toggleHistorial = (fechaKey: string) => setSemanasAbiertas({ ...semanasAbiertas, [fechaKey]: !semanasAbiertas[fechaKey] });

  // renderEtapas y renderTarjetaTrabajo son funciones y no componentes: definidos acá adentro,
  // React los recrearía en cada render y la pantalla saltaría arriba al hacer clic.
  const renderEtapas = (t: any) => {
    const etapas = obtenerEtapasParaTrabajo(t);
    return (
      <div className="flex gap-1 flex-wrap items-center py-1">
        {etapas.map((e: any) => {
          const config = ETAPAS_MULTIFASE[e.id];
          const fase = faseEtapa(t, e.id);
          const observado = e.id === 'e_scit' && fase === 2;
          const colores = fase === ultimaFaseEtapa(e.id)
            ? 'bg-[#727A4E] text-white border-[#727A4E]'
            : observado
              ? 'bg-transparent text-amber-400 border-amber-400 ring-1 ring-inset ring-amber-400'
              : fase > 0
                ? 'bg-transparent text-[#A4B070] border-[#A4B070] ring-1 ring-inset ring-[#A4B070]'
                : 'bg-[#222222] text-zinc-500 border-zinc-700 hover:border-zinc-500';
          return (
            <button key={e.id} onClick={() => config ? ciclarEtapaMultifase(t, e.id) : toggleEtapa(t.id, e.id, t[e.id])}
              title={config ? `${e.label}: ${config.fases[fase]}` : e.label}
              className={`px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded border transition-colors whitespace-nowrap ${colores}`}>
              {config?.textos?.[fase] ?? e.label}
            </button>
          );
        })}
      </div>
    );
  };

  const renderTarjetaTrabajo = (t: any) => {
    const totalEtapas = obtenerEtapasParaTrabajo(t).length;
    const marcadas = contarEtapasMarcadas(t);
    const esPendiente = t.color_alerta === 'amarillo';
    const notaDeEsta = notaEditando && notaEditando.id === t.id ? notaEditando : null;
    return (
      <div key={t.id} className={`p-4 border-b border-zinc-800 last:border-b-0 hover:bg-[#202020] transition-colors border-l-4 ${esPendiente ? 'border-l-yellow-500' : 'border-l-emerald-500'}`}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="lg:w-[24%] min-w-0 shrink-0">
            <div className={`font-black text-sm flex items-center gap-2 ${esPendiente ? 'text-yellow-400' : 'text-emerald-400'}`}>
              <span className="truncate">{t.tipo ? `${t.tipo} - ${t.propietario}` : t.nombre_expediente}</span>
            </div>
            {notaDeEsta ? (
              <input
                autoFocus
                value={notaDeEsta.valor}
                onChange={e => editarNota({ id: t.id, valor: e.target.value })}
                onFocus={e => e.currentTarget.select()}
                onBlur={() => guardarNotaInline(t)}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') editarNota(null);
                }}
                className="w-full mt-0.5 bg-[#111111] border border-[#727A4E] rounded px-1.5 py-1 text-xs font-medium text-zinc-200 focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => editarNota({ id: t.id, valor: t.estado_detalle || "" })}
                title="Tocá para editar la nota"
                className="block w-full text-left rounded px-1 -mx-1 mt-0.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800/60 cursor-text"
              >
                {t.estado_detalle || <span className="italic text-zinc-600">+ agregar nota</span>}
              </button>
            )}
            {t.ubicacion && <div className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[240px]">📍 {t.ubicacion}</div>}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#727A4E] transition-all" style={{ width: `${(marcadas / totalEtapas) * 100}%` }}></div>
              </div>
              <span className="text-[10px] text-zinc-500 font-bold whitespace-nowrap">{marcadas}/{totalEtapas}</span>
            </div>
            {renderEtapas(t)}
          </div>

          <div className="flex gap-1.5 items-center flex-nowrap lg:justify-end shrink-0">
            {!t.e_medido && (
              <a href={generarLinkCalendarExpediente(t)} target="_blank" rel="noreferrer" className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-800/50 px-2 py-1.5 rounded text-[10px] tracking-wider font-bold uppercase whitespace-nowrap" title="Agendar Medición en Google Calendar">📅 Calendar</a>
            )}
            <button onClick={() => iniciarEdicionTrabajo(t)} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1.5 rounded text-white" title="Editar Expediente">✏️</button>
            <button onClick={() => toggleEstadoIngresado(t)}
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded border whitespace-nowrap ${esPendiente ? 'bg-yellow-900/30 hover:bg-yellow-900/60 border-yellow-700/50 text-yellow-400' : 'bg-emerald-900/30 hover:bg-emerald-900/60 border-emerald-700/50 text-emerald-400'}`}
              title={esPendiente ? 'Pendiente: click para pasar a Ingresado' : 'Ingresado: click para pasar a Pendiente'}>
              {esPendiente ? 'Pendiente' : 'Ingresado'}
            </button>
            <button onClick={() => finalizarTrabajo(t)} className="text-xs bg-emerald-900/40 hover:bg-emerald-900/70 border border-emerald-700/50 px-2 py-1.5 rounded text-emerald-300 font-bold" title="Finalizar">✅</button>
            <button onClick={() => eliminarTrabajo(t.id)} className="text-xs bg-red-900/30 hover:bg-red-900/60 border border-red-800/50 px-2 py-1.5 rounded text-red-400 font-bold" title="Eliminar">🗑️</button>
          </div>
        </div>
      </div>
    );
  };

  const listaTrabajosParaDashboard = useMemo(() => {
    return trabajosFinalizados.filter((t: any) => {
      const coincideAnio = filtroAnioDashboard === "Todos" || (t.fecha_finalizacion && t.fecha_finalizacion.startsWith(filtroAnioDashboard));
      const coincideSocio = filtroSocioDashboard === "Todos" || t.encargado === filtroSocioDashboard;
      const coincideTipo = filtroTipoDashboard === "Todos" || (t.tipo && t.tipo.trim().toUpperCase() === filtroTipoDashboard.toUpperCase());
      const palabras = normalizarTexto(busquedaDashboard).split(/\s+/).filter(Boolean);
      const propietario = normalizarTexto(t.propietario || t.nombre_expediente || '');
      const coincideBusqueda = palabras.every(p => propietario.includes(p));
      return coincideAnio && coincideSocio && coincideTipo && coincideBusqueda;
    });
  }, [trabajosFinalizados, filtroAnioDashboard, filtroSocioDashboard, filtroTipoDashboard, busquedaDashboard]);
  const buscandoDashboard = busquedaDashboard.trim() !== "";

  const totalTrabajosDash = listaTrabajosParaDashboard.length;
  const cantLeoDash = listaTrabajosParaDashboard.filter((t: any) => t.encargado === "Leo").length;
  const cantBrunoDash = listaTrabajosParaDashboard.filter((t: any) => t.encargado === "Bruno").length;

  const trabajosDashPorAnioYMes = useMemo(() => {
    return listaTrabajosParaDashboard.reduce((acc: any, t: any) => {
      const anio = t.fecha_finalizacion ? t.fecha_finalizacion.substring(0, 4) : "Sin Fecha";
      const mesNum = t.fecha_finalizacion ? t.fecha_finalizacion.substring(5, 7) : "00";
      if (!acc[anio]) acc[anio] = {};
      if (!acc[anio][mesNum]) acc[anio][mesNum] = [];
      acc[anio][mesNum].push(t);
      return acc;
    }, {});
  }, [listaTrabajosParaDashboard]);

  Object.keys(trabajosDashPorAnioYMes).forEach(anio => {
    Object.keys(trabajosDashPorAnioYMes[anio]).forEach(mesNum => {
      trabajosDashPorAnioYMes[anio][mesNum].sort((a: any, b: any) => {
        const propA = (a.propietario || a.nombre_expediente || "").toLowerCase();
        const propB = (b.propietario || b.nombre_expediente || "").toLowerCase();
        return propA.localeCompare(propB);
      });
    });
  });

  const aniosDashOrdenados = Object.keys(trabajosDashPorAnioYMes).sort((a, b) => b.localeCompare(a));
  const toggleAnioDash = (anio: string) => setAniosDashAbiertos({ ...aniosDashAbiertos, [anio]: !aniosDashAbiertos[anio] });
  const toggleMesDash = (key: string) => setMesesDashAbiertos({ ...mesesDashAbiertos, [key]: !mesesDashAbiertos[key] });

  const anosDisponibles = useMemo(() => {
    return Array.from(new Set([
      ...trabajosFinalizados.map((t: any) => t.fecha_finalizacion ? t.fecha_finalizacion.substring(0, 4) : null)
    ])).filter(Boolean).sort((a: any, b: any) => b.localeCompare(a));
  }, [trabajosFinalizados]);

  const tiposDisponibles = useMemo(() => {
    return Array.from(new Set([
      ...trabajosFinalizados.map((t: any) => t.tipo ? t.tipo.trim().toUpperCase() : null)
    ])).filter(Boolean).sort();
  }, [trabajosFinalizados]);

  const obtenerColorPin = (tipo: string) => {
    const tp = (tipo || "").trim().toUpperCase();
    if (tp.includes("VEP")) return "#3b82f6";
    if (tp.includes("REP")) return "#10b981";
    if (tp.includes("PH")) return "#f59e0b";
    if (tp.includes("DIV")) return "#8b5cf6";
    if (tp.includes("CCU")) return "#ec4899";
    if (tp.includes("CL")) return "#14b8a6";
    if (tp.includes("SIMPLE")) return "#64748b";
    if (tp.includes("EXPROPIACION")) return "#ef4444";
    return "#eab308";
  };

  const centrarMapaEnTrabajo = (t: any) => {
    if (!t.lat || !t.lng || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    map.setView([Number(t.lat), Number(t.lng)], 16, { animate: true });

    const marker = mapMarkersMapRef.current.get(t.id);
    if (marker) {
      marker.openPopup();
    }

    setTrabajoResaltadoId(t.id);
    setTimeout(() => {
      setTrabajoResaltadoId(null);
    }, 2500);
  };

  useEffect(() => {
    if (activeTab === "planos" && !revisionesPlanosCargadas) cargarRevisionesPlanos();
  }, [activeTab, revisionesPlanosCargadas]);

  useEffect(() => {
    if (activeTab !== "dashboard") return;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const initOrUpdateMap = () => {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const osmLayer = L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          maxZoom: 21,
          attribution: 'Map data &copy; Google'
        });

        const sateliteLayer = L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
          maxZoom: 21,
          attribution: 'Imagery &copy; Google'
        });

        const map = L.map(mapContainerRef.current, {
          center: [-31.6333, -60.7000],
          zoom: 12,
          layers: [osmLayer]
        });
        mapInstanceRef.current = map;

        const baseMaps = {
          "🗺️ Calles (Google)": osmLayer,
          "🛰️ Satélite (Google)": sateliteLayer
        };

        L.control.layers(baseMaps).addTo(map);

        markersLayerRef.current = L.layerGroup().addTo(map);
      }

      if (markersLayerRef.current) {
        markersLayerRef.current.clearLayers();
        mapMarkersMapRef.current.clear();

        const puntosBuscados: [number, number][] = [];
        listaTrabajosParaDashboard.forEach((t: any) => {
          if (t.lat && t.lng) {
            puntosBuscados.push([Number(t.lat), Number(t.lng)]);
            const colorPin = obtenerColorPin(t.tipo);
            const markerIcon = L.divIcon({
              className: 'custom-pin',
              html: `<div style="background-color: ${colorPin}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.6);"></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            });

            const marker = L.marker([Number(t.lat), Number(t.lng)], { icon: markerIcon, draggable: true });
            marker.on('dragend', () => {
              const p = marker.getLatLng();
              moverPinRef.current(t, p.lat, p.lng, () => marker.setLatLng([Number(t.lat), Number(t.lng)]));
            });
            marker.bindPopup(`<b>[${t.tipo || 'TRABAJO'}]</b> ${t.propietario || t.nombre_expediente}<br><small>Socio: ${t.encargado} | Año: ${t.fecha_finalizacion ? t.fecha_finalizacion.substring(0,4) : 'S/F'}</small><br><a href="${urlGoogleMaps(t.lat, t.lng)}" target="_blank" rel="noreferrer" style="color:#3b82f6;font-weight:bold;text-decoration:none">📍 Abrir en Google Maps</a>`);
            markersLayerRef.current.addLayer(marker);
            mapMarkersMapRef.current.set(t.id, marker);
          }
        });
        if (buscandoDashboard && puntosBuscados.length > 0) {
          mapInstanceRef.current.fitBounds(puntosBuscados, { maxZoom: 16, padding: [40, 40] });
        } else if (!buscandoDashboard && estabaBuscandoRef.current) {
          mapInstanceRef.current.setView([-31.6333, -60.7000], 12);
        }
        estabaBuscandoRef.current = buscandoDashboard;
      }
    };

    if (!(window as any).L) {
      if (!document.getElementById("leaflet-js")) {
        const script = document.createElement("script");
        script.id = "leaflet-js";
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = initOrUpdateMap;
        document.body.appendChild(script);
      }
    } else {
      initOrUpdateMap();
    }
  }, [activeTab, listaTrabajosParaDashboard]);

  // Mediciones pendientes: trabajos en curso sin la etapa "Medido".
  const tienePin = (t: any) => Number.isFinite(parseFloat(t.lat)) && Number.isFinite(parseFloat(t.lng));
  const medicionesPendientes = trabajosActivos
    .filter((t: any) => !t.e_medido)
    .sort((a: any, b: any) => (a.propietario || a.nombre_expediente || "").localeCompare(b.propietario || b.nombre_expediente || ""));
  const medicionesFiltradas = medicionesPendientes.filter((t: any) => filtroSocioMediciones === "Todos" || t.encargado === filtroSocioMediciones);
  const medicionesConPin = medicionesFiltradas.filter(tienePin);
  const medicionesSinPin = medicionesFiltradas.filter((t: any) => !tienePin(t));
  const clavePinesMediciones = medicionesConPin.map((t: any) => `${t.id}:${t.lat}:${t.lng}`).join("|");

  const centrarMedicion = (t: any) => {
    const map = mapaMedRef.current;
    if (!map) return;
    map.setView([Number(t.lat), Number(t.lng)], 16, { animate: true });
    mapaMedMarkersRef.current.get(t.id)?.openPopup();
  };

  useEffect(() => {
    if (!mapaMedicionesAbierto) {
      if (mapaMedRef.current) { mapaMedRef.current.remove(); mapaMedRef.current = null; mapaMedCapaRef.current = null; }
      return;
    }

    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") setMapaMedicionesAbierto(false); };
    window.addEventListener("keydown", alTeclear);

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const dibujar = () => {
      const L = (window as any).L;
      const contenedor = mapaMedContRef.current;
      if (!L || !contenedor) return;

      if (!mapaMedRef.current) {
        const osmLayer = L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", { maxZoom: 21, attribution: 'Map data &copy; Google' });
        const sateliteLayer = L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", { maxZoom: 21, attribution: 'Imagery &copy; Google' });
        const map = L.map(contenedor, { center: [-31.6333, -60.7000], zoom: 12, layers: [osmLayer] });
        L.control.layers({ "🗺️ Calles (Google)": osmLayer, "🛰️ Satélite (Google)": sateliteLayer }).addTo(map);
        mapaMedRef.current = map;
        mapaMedCapaRef.current = L.layerGroup().addTo(map);
        // Las etiquetas con el nombre solo se muestran de cerca, para que no se tapen entre sí.
        const ajustarEtiquetas = () => contenedor.classList.toggle("med-sin-etiquetas", map.getZoom() < 14);
        map.on("zoomend", ajustarEtiquetas);
        ajustarEtiquetas();
      }

      const map = mapaMedRef.current;
      const capa = mapaMedCapaRef.current;
      map.invalidateSize();
      capa.clearLayers();
      mapaMedMarkersRef.current.clear();

      const puntos: [number, number][] = [];
      medicionesConPin.forEach((t: any) => {
        const lat = Number(t.lat), lng = Number(t.lng);
        puntos.push([lat, lng]);
        const icono = L.divIcon({
          className: 'custom-pin',
          html: `<div style="background-color: ${obtenerColorPin(t.tipo)}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.6);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        const nombre = escaparHTML(t.propietario || t.nombre_expediente);
        const marker = L.marker([lat, lng], { icon: icono });
        marker.bindTooltip(`${escaparHTML(t.tipo)} ${nombre}`, { permanent: true, direction: "right", offset: [10, 0], className: "etiqueta-medicion" });
        marker.bindPopup(
          `<b>[${escaparHTML(t.tipo || 'TRABAJO')}]</b> ${nombre}<br><small>Socio: ${escaparHTML(t.encargado)}${t.estado_detalle ? ` | ${escaparHTML(t.estado_detalle)}` : ""}</small><br>` +
          `<a href="${urlGoogleMaps(lat, lng)}" target="_blank" rel="noreferrer" style="color:#3b82f6;font-weight:bold;text-decoration:none">📍 Abrir en Google Maps</a><br>` +
          `<a href="${generarLinkCalendarExpediente(t)}" target="_blank" rel="noreferrer" style="color:#3b82f6;font-weight:bold;text-decoration:none">📅 Agendar en Calendar</a>`
        );
        capa.addLayer(marker);
        mapaMedMarkersRef.current.set(t.id, marker);
      });
      if (puntos.length > 0) map.fitBounds(puntos, { maxZoom: 15, padding: [40, 40] });
    };

    if ((window as any).L) {
      dibujar();
    } else {
      let script = document.getElementById("leaflet-js") as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "leaflet-js";
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        document.body.appendChild(script);
      }
      script.addEventListener("load", dibujar);
    }

    return () => window.removeEventListener("keydown", alTeclear);
  }, [mapaMedicionesAbierto, clavePinesMediciones]);

  // Pantalla de carga inicial
  if (cargandoAuth) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center font-sans text-zinc-300">
        <div className="text-center">
          <p className="text-[#727A4E] font-bold tracking-widest uppercase animate-pulse">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  // Pantalla de Login si no hay sesión iniciada
  if (!session) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center p-4 font-sans text-zinc-300">
        <div className="bg-[#1A1A1A] p-8 md:p-12 rounded-2xl shadow-2xl border border-zinc-800 max-w-md w-full text-center border-l-4 border-[#727A4E]">
          <h1 className="text-3xl font-black tracking-widest uppercase text-white mb-2">SURVEY</h1>
          <p className="text-[#727A4E] tracking-widest text-xs font-bold mb-8">ADMINISTRACIÓN & GESTIÓN</p>
          
          <p className="text-sm text-zinc-400 mb-6">Iniciá sesión con tu cuenta autorizada para ingresar al sistema.</p>

          <form onSubmit={iniciarSesionPassword} className="space-y-3 text-left">
            <div>
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Email</label>
              <input
                type="email"
                required
                value={emailLogin}
                onChange={(e) => setEmailLogin(e.target.value)}
                className="w-full mt-1 bg-[#111111] border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#727A4E]"
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Contraseña</label>
              <input
                type="password"
                required
                value={passwordLogin}
                onChange={(e) => setPasswordLogin(e.target.value)}
                className="w-full mt-1 bg-[#111111] border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#727A4E]"
                placeholder="••••••••"
              />
            </div>

            {errorLogin && (
              <p className="text-red-400 text-xs font-bold">{errorLogin}</p>
            )}

            <button
              type="submit"
              disabled={enviandoLogin}
              className="w-full bg-white hover:bg-zinc-200 disabled:opacity-60 text-zinc-900 font-bold py-3.5 px-6 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-colors text-sm uppercase tracking-wider"
            >
              {enviandoLogin ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111111] p-4 md:p-8 font-sans text-zinc-300 overflow-x-hidden">
      
      {/* HEADER RESPONSIVO */}
      <header className="mb-6 md:mb-8 bg-[#1A1A1A] p-6 md:p-8 rounded-xl shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-6 border-l-4 border-[#727A4E]">
        <div className="text-center lg:text-left">
          <h1 className="text-3xl md:text-4xl font-black tracking-widest uppercase flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-white">SURVEY</h1>
          <p className="text-[#727A4E] tracking-widest text-xs md:text-sm font-bold mt-1">ADMINISTRACIÓN & GESTIÓN — <span className="text-zinc-400 font-normal text-xs">{session.user.email}</span></p>
        </div>
        <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2 w-full lg:w-auto">
          <button onClick={() => setActiveTab("trabajos")} className={`px-3 py-2 md:px-5 md:py-2.5 rounded-md font-bold tracking-wider uppercase text-[10px] md:text-xs transition-all flex-grow sm:flex-grow-0 ${activeTab === "trabajos" ? "bg-[#727A4E] text-white shadow-md" : "bg-transparent text-zinc-500 hover:text-white border border-zinc-800 hover:border-[#727A4E]"}`}>Expedientes</button>
          <button onClick={() => setActiveTab("dashboard")} className={`px-3 py-2 md:px-5 md:py-2.5 rounded-md font-bold tracking-wider uppercase text-[10px] md:text-xs transition-all flex-grow sm:flex-grow-0 ${activeTab === "dashboard" ? "bg-[#727A4E] text-white shadow-md" : "bg-transparent text-zinc-500 hover:text-white border border-zinc-800 hover:border-[#727A4E]"}`}>📊 Dashboard</button>
          <button onClick={() => setActiveTab("finanzas")} className={`px-3 py-2 md:px-5 md:py-2.5 rounded-md font-bold tracking-wider uppercase text-[10px] md:text-xs transition-all flex-grow sm:flex-grow-0 ${activeTab === "finanzas" ? "bg-[#727A4E] text-white shadow-md" : "bg-transparent text-zinc-500 hover:text-white border border-zinc-800 hover:border-[#727A4E]"}`}>Finanzas</button>
          <button onClick={() => setActiveTab("catastro")} className={`px-3 py-2 md:px-5 md:py-2.5 rounded-md font-bold tracking-wider uppercase text-[10px] md:text-xs transition-all flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 ${activeTab === "catastro" ? "bg-white text-[#1A1A1A] shadow-md" : "bg-[#222222] text-[#727A4E] hover:bg-[#333] border border-[#727A4E]/30"}`}>🔑 SCIT</button>
          <button onClick={() => setActiveTab("planos")} className={`px-3 py-2 md:px-5 md:py-2.5 rounded-md font-bold tracking-wider uppercase text-[10px] md:text-xs transition-all flex-grow sm:flex-grow-0 ${activeTab === "planos" ? "bg-[#727A4E] text-white shadow-md" : "bg-transparent text-zinc-500 hover:text-white border border-zinc-800 hover:border-[#727A4E]"}`}>📐 Planos</button>
          <button onClick={cerrarSesion} className="px-3 py-2 md:px-4 md:py-2.5 rounded-md font-bold tracking-wider uppercase text-[10px] md:text-xs bg-red-900/30 text-red-400 hover:bg-red-900/60 border border-red-800/50 transition-all" title="Cerrar Sesión">🚪 Salir</button>
        </div>
      </header>

      {/* ESTADO DEL SCIT (siempre visible) */}
      <div className={`mb-6 md:mb-8 rounded-xl border-2 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${catastro.usuario === "Libre" ? "bg-green-950/40 border-green-600/60" : "bg-red-950/50 border-red-500/70"}`}>
        <div className="flex-1 min-w-0">
          <div className={`font-black uppercase tracking-widest text-sm md:text-base ${catastro.usuario === "Libre" ? "text-green-400" : "text-red-400"}`}>
            {catastro.usuario === "Libre" ? "✅ SCIT libre" : `🚫 SCIT en uso por ${catastro.usuario}${catastro.usuario === miNombre ? " (vos)" : ""}`}
            {catastro.usuario !== "Libre" && tiempoUso && <span className="ml-3 text-zinc-200 font-bold normal-case tracking-normal">⏱️ {tiempoUso}</span>}
          </div>
          {catastro.fechaLiberacion && (
            <div className="text-[11px] md:text-xs text-zinc-400 mt-0.5">
              🔓 Última liberación: {new Date(catastro.fechaLiberacion).toLocaleString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })} hs{catastro.liberadoPor ? ` · por ${catastro.liberadoPor}` : ""}
            </div>
          )}
        </div>
        {catastro.usuario === "Libre" ? (
          <button onClick={() => tomarCatastro(miNombre)} className="bg-[#727A4E] hover:bg-[#8B9461] text-white font-black text-xs md:text-sm px-6 py-2.5 rounded-lg uppercase tracking-widest shadow-md whitespace-nowrap">🙋‍♂️ Usar SCIT</button>
        ) : (
          <button onClick={liberarCatastro} className="bg-green-600 hover:bg-green-700 text-white font-black text-xs md:text-sm px-6 py-2.5 rounded-lg uppercase tracking-widest shadow-md whitespace-nowrap">🔓 Liberar SCIT</button>
        )}
      </div>

      {/* PESTAÑA: DASHBOARD & MAPA */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="bg-[#1A1A1A] p-4 rounded-xl border border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-lg md:text-xl font-black tracking-widest text-white uppercase">Panel de Estadísticas y Rendimiento</h2>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex flex-col w-full sm:w-56">
                <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1">Buscar propietario</label>
                <div className="relative">
                  <input type="text" placeholder="Ej: Perez" value={busquedaDashboard} onChange={e => setBusquedaDashboard(e.target.value)}
                    className="w-full bg-[#222] border border-zinc-700 text-white p-2 pr-8 rounded text-xs font-bold tracking-wider focus:outline-none focus:border-[#727A4E]" />
                  {buscandoDashboard && (
                    <button type="button" onClick={() => setBusquedaDashboard("")} title="Borrar búsqueda"
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-400 hover:text-white text-sm">✕</button>
                  )}
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1">Año</label>
                <select value={filtroAnioDashboard} onChange={e => setFiltroAnioDashboard(e.target.value)}
                  className="bg-[#222] border border-zinc-700 text-white p-2 rounded text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-[#727A4E] cursor-pointer">
                  <option value="Todos">Todos</option>
                  {anosDisponibles.map((anio: any) => (
                    <option key={anio} value={anio}>{anio}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1">Socio</label>
                <select value={filtroSocioDashboard} onChange={e => setFiltroSocioDashboard(e.target.value)}
                  className="bg-[#222] border border-zinc-700 text-white p-2 rounded text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-[#727A4E] cursor-pointer">
                  <option value="Todos">Todos</option>
                  <option value="Leo">Leo</option>
                  <option value="Bruno">Bruno</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1">Tipo de Trabajo</label>
                <select value={filtroTipoDashboard} onChange={e => setFiltroTipoDashboard(e.target.value)}
                  className="bg-[#222] border border-zinc-700 text-white p-2 rounded text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-[#727A4E] cursor-pointer">
                  <option value="Todos">Todos</option>
                  {tiposDisponibles.map((tp: any) => (
                    <option key={tp} value={tp}>{tp}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#1A1A1A] p-6 rounded-xl border border-zinc-800 text-center shadow-lg">
              <span className="text-xs font-bold uppercase tracking-wider text-[#727A4E] block mb-2">Total Expedientes Filtrados</span>
              <span className="text-4xl md:text-5xl font-black text-white">{totalTrabajosDash}</span>
            </div>
            
            <div className="bg-[#1A1A1A] p-6 rounded-xl border border-zinc-800 text-center shadow-lg">
              <span className="text-xs font-bold uppercase tracking-wider text-[#727A4E] block mb-2">Cerrados por Leo</span>
              <span className="text-4xl md:text-5xl font-black text-[#A4B070]">{cantLeoDash}</span>
              <span className="text-xs text-zinc-500 block mt-1">{totalTrabajosDash > 0 ? Math.round((cantLeoDash / totalTrabajosDash) * 100) : 0}% del total</span>
            </div>

            <div className="bg-[#1A1A1A] p-6 rounded-xl border border-zinc-800 text-center shadow-lg">
              <span className="text-xs font-bold uppercase tracking-wider text-[#727A4E] block mb-2">Cerrados por Bruno</span>
              <span className="text-4xl md:text-5xl font-black text-[#A4B070]">{cantBrunoDash}</span>
              <span className="text-xs text-zinc-500 block mt-1">{totalTrabajosDash > 0 ? Math.round((cantBrunoDash / totalTrabajosDash) * 100) : 0}% del total</span>
            </div>
          </div>

          <div className="bg-[#1A1A1A] p-6 rounded-xl border border-zinc-800 shadow-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
              <div>
                <h3 className="font-bold text-white tracking-widest uppercase text-sm">🗺️ Mapa de Trabajos Realizados</h3>
                <p className="text-xs text-zinc-400">Pines diferenciados por color. Podés alternar entre Calles y Satélite arriba a la derecha. Arrastrá un pin para corregir su ubicación.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase">
                <span className="flex items-center gap-1 bg-[#222] px-2 py-1 rounded"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> VEP</span>
                <span className="flex items-center gap-1 bg-[#222] px-2 py-1 rounded"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> REP</span>
                <span className="flex items-center gap-1 bg-[#222] px-2 py-1 rounded"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> PH</span>
                <span className="flex items-center gap-1 bg-[#222] px-2 py-1 rounded"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span> DIV</span>
                <span className="flex items-center gap-1 bg-[#222] px-2 py-1 rounded"><span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block"></span> CCU</span>
              </div>
            </div>
            <div ref={mapContainerRef} className="w-full h-[450px] rounded-xl overflow-hidden border border-zinc-700 bg-[#161616] relative z-0"></div>
          </div>

          <div className="bg-[#1A1A1A] rounded-xl shadow-lg overflow-hidden border border-zinc-800 p-4 md:p-6">
            <h3 className="font-bold text-white tracking-widest uppercase text-sm mb-4">Expedientes Finalizados por Año y Mes</h3>
            
            {aniosDashOrdenados.length === 0 ? (
              <p className="p-8 text-center text-zinc-500 font-bold tracking-widest uppercase bg-[#222] rounded-lg">No hay expedientes finalizados en este período</p>
            ) : (
              <div className="space-y-4">
                {aniosDashOrdenados.map(anio => {
                  const mesesDelAnio = Object.keys(trabajosDashPorAnioYMes[anio]).sort((a, b) => b.localeCompare(a));
                  const totalAnio = Object.values(trabajosDashPorAnioYMes[anio]).flat().length;
                  const anioAbierto = buscandoDashboard || aniosDashAbiertos[anio];

                  return (
                    <div key={anio} className="bg-[#111111] rounded-lg overflow-hidden border border-zinc-800">
                      <div onClick={() => toggleAnioDash(anio)} className="bg-[#222222] p-4 border-b border-zinc-800 flex justify-between cursor-pointer hover:bg-[#2A2A2A] transition-colors select-none">
                        <h4 className="font-bold text-white uppercase tracking-widest text-sm flex items-center gap-2">
                          <span className="text-[#727A4E] text-xs">{anioAbierto ? '▼' : '▶'}</span> AÑO {anio}
                        </h4>
                        <span className="text-[#727A4E] font-bold text-sm bg-[#111] px-3 py-1 rounded-full border border-zinc-700">
                          {totalAnio} Exp.
                        </span>
                      </div>
                      
                      {anioAbierto && (
                        <div className="p-3 space-y-3">
                          {mesesDelAnio.map(mesNum => {
                            const keyMesDash = `${anio}-${mesNum}`;
                            const listaMes = trabajosDashPorAnioYMes[anio][mesNum];
                            const nombreMes = nombresMeses[mesNum] || mesNum;
                            const totalMes = listaMes.length;
                            const mesAbierto = buscandoDashboard || mesesDashAbiertos[keyMesDash];

                            return (
                              <div key={keyMesDash} className="bg-[#161616] rounded-lg overflow-hidden border border-zinc-800 ml-2 md:ml-4">
                                <div onClick={() => toggleMesDash(keyMesDash)} className="p-3 bg-[#1D1D1D] flex justify-between items-center cursor-pointer hover:bg-[#252525] select-none">
                                  <span className="font-bold text-zinc-300 uppercase tracking-wider text-xs flex items-center gap-2">
                                    <span className="text-[#727A4E] text-[10px]">{mesAbierto ? '▼' : '▶'}</span> {nombreMes}
                                  </span>
                                  <span className="text-xs text-zinc-400 font-bold">{totalMes} Exp.</span>
                                </div>

                                {mesAbierto && (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left whitespace-nowrap min-w-[650px]">
                                      <thead>
                                        <tr className="bg-[#1A1A1A] text-[#727A4E] font-bold uppercase text-[10px] tracking-wider border-b border-zinc-800">
                                          <th className="p-3 w-24">Tipo</th>
                                          <th className="p-3">Propietario</th>
                                          <th className="p-3">Socio</th>
                                          <th className="p-3">Ubicación</th>
                                          <th className="p-3">Fecha Finalización</th>
                                          <th className="p-3 w-24 text-center">Pin / Mapa</th>
                                          <th className="p-3 w-16 text-center">Editar</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {listaMes.map((t: any) => {
                                          const tieneCoordenadas = t.lat && t.lng;
                                          const esResaltado = trabajoResaltadoId === t.id;
                                          return (
                                            <tr key={t.id} className={`border-b border-zinc-800 text-xs transition-colors ${esResaltado ? 'bg-[#727A4E]/30' : 'hover:bg-[#2A2A2A]'}`}>
                                              <td className="p-3 font-black text-[#A4B070]">{t.tipo || '-'}</td>
                                              <td className="p-3"><span className="font-bold text-zinc-300 block">{t.propietario || t.nombre_expediente}</span></td>
                                              <td className="p-3 text-zinc-400 font-bold">{t.encargado}</td>
                                              <td className="p-3 text-zinc-400">{t.ubicacion || (tieneCoordenadas ? `${t.lat}, ${t.lng}` : '-')}</td>
                                              <td className="p-3 text-zinc-400">{t.fecha_finalizacion ? new Date(t.fecha_finalizacion).toLocaleDateString("es-AR", { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</td>
                                              <td className="p-3 text-center">
                                                {tieneCoordenadas ? (
                                                  <div className="flex items-center justify-center gap-1.5">
                                                    <button onClick={() => centrarMapaEnTrabajo(t)} className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-800/50 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors" title="Centrar mapa en este trabajo">
                                                      📍 Pin
                                                    </button>
                                                    <a href={urlGoogleMaps(t.lat, t.lng)} target="_blank" rel="noreferrer" className="bg-zinc-700/40 hover:bg-zinc-700/70 text-zinc-300 border border-zinc-600/50 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors" title="Abrir en Google Maps">
                                                      🗺️
                                                    </a>
                                                  </div>
                                                ) : (
                                                  <button onClick={() => setTrabajoEditandoDash({ ...t })} className="text-zinc-500 hover:text-white text-[10px] underline" title="Agregar ubicación">Sin GPS · ubicar</button>
                                                )}
                                              </td>
                                              <td className="p-3 text-center">
                                                <button onClick={() => setTrabajoEditandoDash({ ...t })} className="text-sm bg-[#222] hover:bg-[#333] border border-zinc-700 px-2 py-1 rounded text-white" title="Editar Expediente">✏️</button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN RÁPIDA DE EXPEDIENTE */}
      {trabajoEditandoDash && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <form onSubmit={guardarEdicionRapidaDash} className="bg-[#1A1A1A] border border-zinc-700 p-6 rounded-xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-black text-white text-base tracking-widest uppercase border-b border-zinc-800 pb-2">Editar Expediente</h3>
            
            <div>
              <label className="text-[10px] uppercase font-bold text-[#727A4E] block mb-1">Tipo de Trámite</label>
              <input type="text" className="w-full bg-[#222] border border-zinc-700 text-white p-2 rounded text-xs" value={trabajoEditandoDash.tipo || ""} onChange={e => setTrabajoEditandoDash({...trabajoEditandoDash, tipo: e.target.value})} required />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-[#727A4E] block mb-1">Propietario</label>
              <input type="text" className="w-full bg-[#222] border border-zinc-700 text-white p-2 rounded text-xs" value={trabajoEditandoDash.propietario || ""} onChange={e => setTrabajoEditandoDash({...trabajoEditandoDash, propietario: e.target.value})} required />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-[#727A4E] block mb-1">Socio Encargado</label>
              <select className="w-full bg-[#222] border border-zinc-700 text-white p-2 rounded text-xs" value={trabajoEditandoDash.encargado || "Leo"} onChange={e => setTrabajoEditandoDash({...trabajoEditandoDash, encargado: e.target.value})}>
                <option value="Leo">Leo</option>
                <option value="Bruno">Bruno</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-[#727A4E] block mb-1">Fecha de Finalización</label>
              <input type="date" className="w-full bg-[#222] border border-zinc-700 text-white p-2 rounded text-xs cursor-pointer" value={trabajoEditandoDash.fecha_finalizacion ? trabajoEditandoDash.fecha_finalizacion.substring(0,10) : ""} onChange={e => setTrabajoEditandoDash({...trabajoEditandoDash, fecha_finalizacion: e.target.value})} required />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-[#727A4E] block mb-1">Ubicación (dirección o coordenadas)</label>
              <div className="flex gap-2">
                <input type="text" className="flex-1 bg-[#222] border border-zinc-700 text-white p-2 rounded text-xs" placeholder="Ej: J. P. López 850, o -31.63, -60.70"
                  value={trabajoEditandoDash.ubicacion || ""}
                  onChange={e => setTrabajoEditandoDash({...trabajoEditandoDash, ubicacion: e.target.value})}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarUbicacionModal(); } }} />
                <button type="button" onClick={buscarUbicacionModal} disabled={buscandoModal}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 text-white text-xs font-bold rounded uppercase">{buscandoModal ? "..." : "Buscar"}</button>
              </div>
              {sugerenciasModal.length > 0 && (
                <div className="mt-1 border border-zinc-700 rounded divide-y divide-zinc-800 bg-[#1D1D1D] max-h-40 overflow-y-auto">
                  {sugerenciasModal.map((item: any, idx: number) => (
                    <button key={idx} type="button" onClick={() => elegirSugerenciaModal(item)}
                      className="block w-full text-left p-2 text-[11px] text-zinc-300 hover:bg-[#2A2A2A]">📍 {item.display_name}</button>
                  ))}
                </div>
              )}
              {mensajeUbicacionModal && <p className="text-[10px] text-zinc-400 mt-1">{mensajeUbicacionModal}</p>}
              <p className="text-[10px] text-zinc-500 mt-1">
                {aNumeroONull(trabajoEditandoDash.lat) !== null && aNumeroONull(trabajoEditandoDash.lng) !== null ? (
                  <>📍 Pin en {Number(trabajoEditandoDash.lat).toFixed(5)}, {Number(trabajoEditandoDash.lng).toFixed(5)}
                    <button type="button" onClick={() => setTrabajoEditandoDash({...trabajoEditandoDash, lat: null, lng: null})} className="ml-2 underline hover:text-white">Quitar pin</button></>
                ) : "Sin pin en el mapa"}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
              <button type="button" onClick={cerrarModalEdicionDash} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded uppercase">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-[#727A4E] hover:bg-[#8B9461] text-white text-xs font-bold rounded uppercase">Guardar Cambios</button>
            </div>
          </form>
        </div>
      )}

      {/* VENTANA: MEDICIONES PENDIENTES (mapa para coordinar salidas) */}
      {mapaMedicionesAbierto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 md:p-4">
          <style>{`
            .etiqueta-medicion { background: #111; color: #fff; border: 1px solid #555; font-weight: 700; font-size: 10px; padding: 1px 5px; box-shadow: none; }
            .leaflet-tooltip-right.etiqueta-medicion::before { display: none; }
            .med-sin-etiquetas .etiqueta-medicion { display: none; }
          `}</style>
          <div className="bg-[#1A1A1A] rounded-xl border border-zinc-800 w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 p-3 md:p-4 border-b border-zinc-800">
              <h3 className="text-sm md:text-lg font-black tracking-widest text-white uppercase">📍 Mediciones pendientes</h3>
              <span className="text-xs text-zinc-400">{medicionesConPin.length} en el mapa{medicionesSinPin.length > 0 ? ` · ${medicionesSinPin.length} sin ubicación` : ""}</span>
              <div className="flex gap-1 md:ml-auto">
                {["Todos", "Leo", "Bruno"].map(socio => (
                  <button key={socio} onClick={() => setFiltroSocioMediciones(socio)} className={`px-3 py-1 rounded text-[10px] md:text-xs font-bold tracking-wider uppercase transition-colors ${filtroSocioMediciones === socio ? "bg-[#727A4E] text-white" : "border border-zinc-700 text-zinc-400 hover:text-white"}`}>{socio}</button>
                ))}
              </div>
              <button onClick={() => setMapaMedicionesAbierto(false)} className="text-zinc-400 hover:text-white text-xl px-2" title="Cerrar">✕</button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col md:flex-row">
              <div className="relative flex-1 min-h-[280px]">
                <div ref={mapaMedContRef} className="absolute inset-0" />
              </div>
              <div className="md:w-80 max-h-[38%] md:max-h-none overflow-y-auto border-t md:border-t-0 md:border-l border-zinc-800 p-2 space-y-1">
                {medicionesFiltradas.length === 0 && (
                  <p className="p-4 text-center text-xs text-zinc-500 font-bold tracking-wider uppercase">No hay mediciones pendientes</p>
                )}
                {medicionesConPin.map((t: any) => (
                  <button key={t.id} onClick={() => centrarMedicion(t)} className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-colors">
                    <span className="w-3 h-3 rounded-full shrink-0 border border-white" style={{ backgroundColor: obtenerColorPin(t.tipo) }}></span>
                    <span className="text-xs text-zinc-200 truncate"><b>[{t.tipo}]</b> {t.propietario || t.nombre_expediente}</span>
                    <span className="ml-auto text-[10px] text-zinc-500 shrink-0">{t.encargado}</span>
                  </button>
                ))}
                {medicionesSinPin.length > 0 && (
                  <>
                    <p className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold text-zinc-500">Sin ubicación cargada</p>
                    {medicionesSinPin.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 opacity-60">
                        <span className="w-3 h-3 rounded-full shrink-0 border border-zinc-600"></span>
                        <span className="text-xs text-zinc-400 truncate"><b>[{t.tipo}]</b> {t.propietario || t.nombre_expediente}</span>
                        <span className="ml-auto text-[10px] text-zinc-600 shrink-0">{t.encargado}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: TRABAJOS EN CURSO E HISTORIAL */}
      {activeTab === "trabajos" && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 md:gap-4 border-b border-zinc-800 pb-4">
            <button onClick={() => setSubTabTrabajos("activos")} className={`flex-1 md:flex-none font-bold tracking-widest uppercase text-xs md:text-sm px-4 py-2 rounded transition-colors ${subTabTrabajos === "activos" ? "bg-[#727A4E] text-white" : "text-zinc-500 hover:bg-zinc-800"}`}>🟢 En Curso</button>
            <button onClick={() => setSubTabTrabajos("finalizados")} className={`flex-1 md:flex-none font-bold tracking-widest uppercase text-xs md:text-sm px-4 py-2 rounded transition-colors ${subTabTrabajos === "finalizados" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:bg-zinc-800"}`}>📁 Historial de Finalizados</button>
            <button onClick={() => setMapaMedicionesAbierto(true)} className="w-full md:w-auto md:ml-auto font-bold tracking-widest uppercase text-xs md:text-sm px-4 py-2 rounded border border-[#727A4E] text-[#A4B070] hover:bg-[#727A4E] hover:text-white transition-colors">📍 Mediciones pendientes ({medicionesPendientes.length})</button>
          </div>

          {subTabTrabajos === "activos" && (
            <>
              {/* FORMULARIO DE CARGA DE EXPEDIENTE */}
              <form onSubmit={guardarTrabajo} className="bg-[#1A1A1A] p-4 md:p-6 rounded-xl shadow-lg flex flex-col gap-4 border border-zinc-800">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Tipo</label>
                    <input required className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevoTrabajo.tipo} onChange={e => setNuevoTrabajo({...nuevoTrabajo, tipo: e.target.value})} placeholder="Ej: VEP"/>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Propietario</label>
                    <input required className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevoTrabajo.propietario} onChange={e => setNuevoTrabajo({...nuevoTrabajo, propietario: e.target.value})} placeholder="Ej: Juan Perez"/>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Encargado</label>
                    <select className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevoTrabajo.encargado} onChange={e => setNuevoTrabajo({...nuevoTrabajo, encargado: e.target.value})}><option>Leo</option><option>Bruno</option></select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Notas / Estado (Opcional)</label>
                    <input ref={notasInputRef} className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevoTrabajo.estado} onChange={e => setNuevoTrabajo({...nuevoTrabajo, estado: e.target.value})} placeholder="Ej: Esperando firma"/>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Estado de Alerta</label>
                    <select className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevoTrabajo.color} onChange={e => setNuevoTrabajo({...nuevoTrabajo, color: e.target.value})}><option value="verde">Ingresado</option><option value="amarillo">Pendiente</option></select>
                  </div>
                </div>

                {/* BUSCADOR POR PARTIDA CATASTRAL (SCIT + IDESF) */}
                <div>
                  <label className="text-xs uppercase tracking-wider font-bold text-[#727A4E] block mb-1">Partida Catastral (opcional — autocompleta la ubicación)</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]"
                      value={partidaInput}
                      onChange={e => setPartidaInput(formatearPartidaInput(e.target.value))}
                      placeholder="Ej: 01-01-01 123456/0000"
                    />
                    <button
                      type="button"
                      onClick={buscarUbicacionPorPartida}
                      disabled={buscandoPartida}
                      className="px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider bg-[#727A4E] hover:bg-[#8B9461] disabled:opacity-60 text-white whitespace-nowrap"
                    >
                      {buscandoPartida ? "Buscando..." : "Buscar"}
                    </button>
                  </div>
                  {errorPartida && <p className="text-red-400 text-xs font-bold mt-1">{errorPartida}</p>}
                </div>

                {/* BUSCADOR INTELIGENTE TIPO MAPS */}
                <div className="relative">
                  <label className="text-xs uppercase tracking-wider font-bold text-[#727A4E] block mb-1">Ubicación (Buscador inteligente o pegá coordenadas ej: -31.63, -60.70)</label>
                  <div className="relative">
                    <input 
                      className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 pr-10 rounded focus:outline-none focus:border-[#727A4E]" 
                      value={nuevoTrabajo.ubicacion} 
                      onChange={e => buscarDireccionNominatim(e.target.value)} 
                      placeholder="Ej: J. P. López 850, Santa Fe..."
                    />
                    <span className="absolute right-3 top-3.5 text-zinc-500 pointer-events-none">🔍</span>
                  </div>

                  {(sugerenciasDireccion.length > 0 || buscandoDireccion) && (
                    <div className="absolute left-0 right-0 bg-[#1D1D1D] border border-zinc-700 rounded-b-xl shadow-2xl z-50 max-h-56 overflow-y-auto mt-1 divide-y divide-zinc-800">
                      {buscandoDireccion && sugerenciasDireccion.length === 0 && (
                        <div className="p-3 text-xs text-zinc-500 italic">Buscando...</div>
                      )}
                      {sugerenciasDireccion.map((item: any, idx: number) => (
                        <div 
                          key={idx} 
                          onClick={() => seleccionarSugerencia(item)} 
                          className="p-3 text-xs text-zinc-300 hover:bg-[#2A2A2A] cursor-pointer flex items-center gap-2.5 transition-colors"
                        >
                          <span className="text-base">📍</span>
                          <span className="font-medium line-clamp-1">{item.display_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-2">
                  {editandoTrabajoId && <button type="button" onClick={() => {setEditandoTrabajoId(null); setNuevoTrabajo({ tipo: "", propietario: "", estado: "", color: "verde", encargado: "Leo", ubicacion: "", lat: "", lng: "" }); setPartidaInput(""); setErrorPartida("");}} className="px-6 py-3 rounded-md font-bold tracking-widest text-zinc-300 bg-zinc-800 hover:bg-zinc-700 uppercase text-xs">Cancelar</button>}
                  <button type="submit" className={`px-8 py-3 rounded-md font-bold tracking-widest text-white uppercase text-xs transition-colors ${editandoTrabajoId ? 'bg-orange-600 hover:bg-orange-500' : 'bg-[#727A4E] hover:bg-[#8B9461]'}`}>{editandoTrabajoId ? "Guardar Cambios" : "Agregar Expediente"}</button>
                </div>
              </form>

              <div className="space-y-6">
                
                {/* SECCIÓN EXPEDIENTES LEO */}
                <div className="bg-[#1A1A1A] rounded-xl shadow-lg overflow-hidden border border-zinc-800">
                  <div onClick={() => setLeoAbierto(!leoAbierto)} className="bg-[#222222] p-4 border-b border-zinc-800 flex justify-between cursor-pointer hover:bg-[#2A2A2A] transition-colors select-none">
                    <h3 className="font-bold text-white tracking-widest uppercase text-sm flex items-center gap-2"><span className="text-[#727A4E] text-xs">{leoAbierto ? '▼' : '▶'}</span> Expedientes Leo</h3>
                    <span className="text-[#727A4E] font-bold text-sm bg-[#111] px-3 py-1 rounded-full border border-zinc-700">{trabajosLeo.length} Activos</span>
                  </div>
                  
                  {leoAbierto && (
                    <div>
                      {trabajosLeo.map((t: any) => renderTarjetaTrabajo(t))}
                    </div>
                  )}
                </div>

                {/* SECCIÓN EXPEDIENTES BRUNO */}
                <div className="bg-[#1A1A1A] rounded-xl shadow-lg overflow-hidden border border-zinc-800">
                  <div onClick={() => setBrunoAbierto(!brunoAbierto)} className="bg-[#222222] p-4 border-b border-zinc-800 flex justify-between cursor-pointer hover:bg-[#2A2A2A] transition-colors select-none">
                    <h3 className="font-bold text-white tracking-widest uppercase text-sm flex items-center gap-2"><span className="text-[#727A4E] text-xs">{brunoAbierto ? '▼' : '▶'}</span> Expedientes Bruno</h3>
                    <span className="text-[#727A4E] font-bold text-sm bg-[#111] px-3 py-1 rounded-full border border-zinc-700">{trabajosBruno.length} Activos</span>
                  </div>
                  
                  {brunoAbierto && (
                    <div>
                      {trabajosBruno.map((t: any) => renderTarjetaTrabajo(t))}
                    </div>
                  )}
                </div>

              </div>
            </>
          )}

          {subTabTrabajos === "finalizados" && (
            <div className="bg-[#1A1A1A] rounded-xl shadow-lg overflow-hidden border border-zinc-800 p-4 md:p-6">
              <div className="flex flex-col xl:flex-row justify-between items-start gap-4 mb-6">
                <div className="w-full">
                  <h3 className="font-bold text-white tracking-widest uppercase text-sm mb-4">Historial de Finalizados</h3>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-4 w-full">
                    <div className="flex-1 sm:flex-none">
                      <label className="text-xs uppercase tracking-wider font-bold text-zinc-500 block mb-1">Buscar Propietario</label>
                      <input type="text" placeholder="Ej: Juan Perez..." value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)}
                        className="w-full border-b-2 border-zinc-700 bg-[#1A1A1A] text-white p-2 rounded focus:outline-none focus:border-[#727A4E] text-sm"/>
                    </div>
                    <div className="flex-1 sm:flex-none">
                      <label className="text-xs uppercase tracking-wider font-bold text-zinc-500 block mb-1">Filtrar por Tipo</label>
                      <input type="text" placeholder="Ej: VEP, PH, M..." value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                        className="w-full border-b-2 border-zinc-700 bg-[#1A1A1A] text-white p-2 rounded focus:outline-none focus:border-[#727A4E] text-sm"/>
                    </div>
                    <div className="flex-1 sm:flex-none">
                      <label className="text-xs uppercase tracking-wider font-bold text-zinc-500 block mb-1">Encargado</label>
                      <select value={filtroEncargado} onChange={e => setFiltroEncargado(e.target.value)}
                        className="w-full border-b-2 border-zinc-700 bg-[#1A1A1A] text-white p-2 rounded focus:outline-none focus:border-[#727A4E] text-sm">
                        <option value="Todos">Todos</option>
                        <option value="Leo">Leo</option>
                        <option value="Bruno">Bruno</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="text-left xl:text-right w-full xl:w-auto">
                  <span className="bg-[#727A4E]/20 text-[#A4B070] px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border border-[#727A4E]/30 block text-center xl:inline-block">{trabajosFiltrados.length} Terminados</span>
                </div>
              </div>

              {aniosOrdenados.length === 0 ? (
                <p className="p-8 text-center text-zinc-500 font-bold tracking-widest uppercase bg-[#222] rounded-lg">No se encontraron expedientes</p>
              ) : (
                <div className="space-y-4">
                  {aniosOrdenados.map(anio => {
                    const mesesDelAnio = Object.keys(trabajosPorAnioYMes[anio]).sort((a, b) => b.localeCompare(a));
                    return (
                      <div key={anio} className="bg-[#111111] rounded-lg overflow-hidden border border-zinc-800">
                        <div onClick={() => toggleAnio(anio)} className="bg-[#222222] p-4 border-b border-zinc-800 flex justify-between cursor-pointer hover:bg-[#2A2A2A] transition-colors select-none">
                          <h4 className="font-bold text-white uppercase tracking-widest text-sm flex items-center gap-2">
                            <span className="text-[#727A4E] text-xs">{aniosAbiertos[anio] ? '▼' : '▶'}</span> AÑO {anio}
                          </h4>
                          <span className="text-[#727A4E] font-bold text-sm bg-[#111] px-3 py-1 rounded-full border border-zinc-700">
                            {Object.values(trabajosPorAnioYMes[anio]).flat().length} Exp.
                          </span>
                        </div>
                        
                        {aniosAbiertos[anio] && (
                          <div className="p-3 space-y-3">
                            {mesesDelAnio.map(mesNum => {
                              const keyMes = `${anio}-${mesNum}`;
                              const listaMes = trabajosPorAnioYMes[anio][mesNum];
                              const nombreMes = nombresMeses[mesNum] || mesNum;

                              return (
                                <div key={keyMes} className="bg-[#161616] rounded-lg overflow-hidden border border-zinc-800 ml-2 md:ml-4">
                                  <div onClick={() => toggleMes(keyMes)} className="p-3 bg-[#1D1D1D] flex justify-between cursor-pointer hover:bg-[#252525] select-none">
                                    <span className="font-bold text-zinc-300 uppercase tracking-wider text-xs flex items-center gap-2">
                                      <span className="text-[#727A4E] text-[10px]">{mesesAbiertos[keyMes] ? '▼' : '▶'}</span> {nombreMes}
                                    </span>
                                    <span className="text-xs text-zinc-500 font-bold">{listaMes.length} Exp.</span>
                                  </div>

                                  {mesesAbiertos[keyMes] && (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left whitespace-nowrap min-w-[500px]">
                                        <thead>
                                          <tr className="bg-[#1A1A1A] text-[#727A4E] font-bold uppercase text-[10px] tracking-wider border-b border-zinc-800">
                                            <th className="p-3 w-24">Tipo</th>
                                            <th className="p-3">Propietario</th>
                                            <th className="p-3">Encomienda</th>
                                            <th className="p-3">Ubicación</th>
                                            <th className="p-3">Fecha Finalización</th>
                                            <th className="p-3 w-12 text-center">Acción</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {listaMes.map((t: any) => (
                                            <tr key={t.id} className="border-b border-zinc-800 hover:bg-[#2A2A2A] text-xs">
                                              <td className="p-3 font-black text-[#A4B070]">{t.tipo || '-'}</td>
                                              <td className="p-3"><span className="font-bold text-zinc-300 block">{t.propietario || t.nombre_expediente}</span></td>
                                              <td className="p-3 text-zinc-400 font-bold">{t.encargado}</td>
                                              <td className="p-3 text-zinc-400">{t.ubicacion || (t.lat ? `${t.lat}, ${t.lng}` : '-')}</td>
                                              <td className="p-3 text-zinc-400">{t.fecha_finalizacion ? new Date(t.fecha_finalizacion).toLocaleDateString("es-AR", { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</td>
                                              <td className="p-3 text-center"><button onClick={() => eliminarTrabajo(t.id)} title="Eliminar definitivamente" className="text-sm opacity-30 hover:opacity-100 hover:text-red-500 transition-all">🗑️</button></td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "catastro" && (
        <div className="flex flex-col items-center justify-center pt-4 md:pt-10 px-2">
          <div className={`p-8 md:p-12 rounded-3xl shadow-2xl w-full max-w-2xl text-center border-4 ${catastro.usuario === 'Libre' ? 'bg-green-100 border-green-500' : 'bg-red-100 border-red-500'}`}>
            <h2 className="text-xl md:text-2xl font-bold text-zinc-800 mb-2 uppercase tracking-widest">Estado del Sistema</h2>
            <div className={`text-4xl md:text-6xl font-black mb-6 uppercase tracking-wider ${catastro.usuario === 'Libre' ? 'text-green-700' : 'text-red-700'}`}>
              {catastro.usuario === 'Libre' ? '✅ LIBRE' : `🚫 EN USO POR ${catastro.usuario}`}
            </div>
            {catastro.usuario !== "Libre" && (
              <div className="text-lg md:text-xl font-bold text-zinc-800 mb-8 bg-white/70 py-3 px-6 rounded-xl shadow-sm inline-block">⏱️ Tiempo: <span className="text-red-600 block sm:inline">{tiempoUso}</span></div>
            )}
            {catastro.fechaLiberacion && (
              <div className="text-sm md:text-base font-semibold text-zinc-700 mb-6">
                🔓 Última liberación: {new Date(catastro.fechaLiberacion).toLocaleString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })} hs{catastro.liberadoPor ? ` · por ${catastro.liberadoPor}` : ""}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-4">
              {catastro.usuario === "Libre" ? (
                <button onClick={() => tomarCatastro(miNombre)} className="bg-[#1A1A1A] hover:bg-[#333] text-white text-lg md:text-xl font-bold px-8 py-4 rounded-xl shadow-lg uppercase tracking-widest w-full sm:w-auto">🙋‍♂️ Usar ({miNombre})</button>
              ) : ( <button onClick={liberarCatastro} className="bg-green-600 hover:bg-green-700 text-white text-xl md:text-2xl font-black px-12 py-5 rounded-xl shadow-lg w-full uppercase tracking-widest">🔓 LIBERAR SISTEMA</button> )}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: FINANZAS */}
      {activeTab === "finanzas" && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 md:gap-4 border-b border-zinc-800 pb-4">
            <button onClick={() => setSubTabFinanzas("actual")} className={`flex-1 md:flex-none font-bold tracking-widest uppercase text-xs md:text-sm px-4 py-2 rounded transition-colors ${subTabFinanzas === "actual" ? "bg-[#727A4E] text-white" : "text-zinc-500 hover:bg-zinc-800"}`}>💵 Semana Actual</button>
            <button onClick={() => setSubTabFinanzas("historial")} className={`flex-1 md:flex-none font-bold tracking-widest uppercase text-xs md:text-sm px-4 py-2 rounded transition-colors ${subTabFinanzas === "historial" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:bg-zinc-800"}`}>📁 Historial de Liquidaciones</button>
          </div>

          {subTabFinanzas === "actual" && (
            <div className="space-y-6">
              <div className="bg-[#1A1A1A] p-4 md:p-6 rounded-xl shadow-lg border border-zinc-800">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-zinc-800 gap-4">
                  <h2 className="font-black tracking-widest text-white uppercase text-sm md:text-base">{nuevaFinanza.esGasto5050 ? "💼 CARGAR GASTO COMPARTIDO (50/50)" : "📝 CARGAR EXPEDIENTE NORMAL"}</h2>
                  <button onClick={toggleGasto5050} type="button" className={`w-full md:w-auto px-5 py-2 text-xs font-bold uppercase tracking-wider rounded border transition-colors ${nuevaFinanza.esGasto5050 ? 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700' : 'bg-transparent text-[#727A4E] border-[#727A4E] hover:bg-[#727A4E]/10'}`}>
                    {nuevaFinanza.esGasto5050 ? "Volver a Expedientes" : "Cargar Gasto Compartido"}
                  </button>
                </div>

                <form onSubmit={guardarFinanza} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  {!nuevaFinanza.esGasto5050 ? (
                    <>
                      <div className="col-span-1 md:col-span-2 lg:col-span-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="inline-flex rounded-lg border border-zinc-700 overflow-hidden self-start">
                          <button type="button" onClick={() => cambiarTipoPago("entrega")} className={`px-6 py-2 text-xs font-black tracking-widest uppercase transition-colors ${nuevaFinanza.tipoPago === "entrega" ? "bg-[#727A4E] text-white" : "bg-[#222222] text-zinc-400 hover:text-white"}`}>Entrega</button>
                          <button type="button" onClick={() => cambiarTipoPago("saldo")} className={`px-6 py-2 text-xs font-black tracking-widest uppercase transition-colors ${nuevaFinanza.tipoPago === "saldo" ? "bg-yellow-600 text-white" : "bg-[#222222] text-zinc-400 hover:text-white"}`}>Saldo</button>
                          <button type="button" onClick={() => cambiarTipoPago("gastos")} className={`px-6 py-2 text-xs font-black tracking-widest uppercase transition-colors ${nuevaFinanza.tipoPago === "gastos" ? "bg-red-700 text-white" : "bg-[#222222] text-zinc-400 hover:text-white"}`}>Gastos</button>
                        </div>
                        <span className="text-[10px] md:text-xs text-zinc-500">{nuevaFinanza.tipoPago === "gastos" ? "Gastos: sin ingreso. Todo arranca en $0; completá solo los gastos que corresponden a este expediente." : nuevaFinanza.tipoPago === "saldo" ? "Saldo: aportes y gastos del trámite en $0 (ya se descontaron en la entrega)." : "Entrega: se descuentan los aportes y los gastos del trámite."}</span>
                      </div>
                      <div><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Tipo</label><input ref={tipoInputRef} required className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.tramite} onChange={e => actualizarValoresFinanza('tramite', e.target.value)}/></div>
                      <div><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Propietario</label><input required className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.propietario} onChange={e => setNuevaFinanza({...nuevaFinanza, propietario: e.target.value})}/></div>
                      <div><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Entró por</label><select className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.encargado} onChange={e => actualizarValoresFinanza('encargado', e.target.value)}><option value="Leo">Leo</option><option value="Bruno">Bruno</option></select></div>
                      {nuevaFinanza.tipoPago !== "gastos" && (
                        <div><label className="text-xs uppercase tracking-wider font-bold text-[#A4B070]">Ingreso Total ($)</label><input type="text" inputMode="numeric" required className="w-full border-b-2 border-[#727A4E] bg-[#222222] p-3 rounded font-black text-[#A4B070] focus:outline-none focus:border-[#8B9461]" value={nuevaFinanza.ingreso === 0 ? "" : formatearPlata(nuevaFinanza.ingreso)} onChange={e => handlePlataInput('ingreso', e.target.value)} placeholder="0"/></div>
                      )}
                      <div className="col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4 border border-zinc-800 rounded-lg p-3">
                        <div className="md:col-span-2 text-[10px] uppercase tracking-widest font-bold text-zinc-500">Aportes <span className="normal-case tracking-normal font-normal">(uno solo por expediente)</span></div>
                        <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Caja ($)</label><input type="text" inputMode="numeric" className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.caja === 0 ? "" : formatearPlata(nuevaFinanza.caja)} onChange={e => handlePlataInput('caja', e.target.value)} placeholder="0"/></div>
                        <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Colegio ($)</label><input type="text" inputMode="numeric" className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.colegio === 0 ? "" : formatearPlata(nuevaFinanza.colegio)} onChange={e => handlePlataInput('colegio', e.target.value)} placeholder="0"/></div>
                      </div>
                      <div className="col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 border border-zinc-800 rounded-lg p-3">
                        <div className="md:col-span-3 text-[10px] uppercase tracking-widest font-bold text-zinc-500">Gastos del trámite <span className="normal-case tracking-normal font-normal">(se multiplican por lote)</span></div>
                        {renderContadorGasto("Certificado", `$${formatearPlata(GASTO_CERTIFICADO)} c/u`, GASTO_CERTIFICADO, "cantCert", nuevaFinanza.encargado)}
                        {renderContadorGasto("Título", `$${formatearPlata(GASTO_TITULO)} c/u`, GASTO_TITULO, "cantTitulo", "Bruno")}
                        {renderContadorGasto("SET", `$${formatearPlata(GASTO_SET)} c/u`, GASTO_SET, "cantSet", "Bruno")}
                      </div>
                      <div className="col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4 border border-zinc-800 rounded-lg p-3">
                        <div className="md:col-span-2 text-[10px] uppercase tracking-widest font-bold text-zinc-500">Extras de cada uno <span className="normal-case tracking-normal font-normal">(viáticos, nafta, lavado, comida, etc.)</span></div>
                        <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Extra Leo ($)</label><input type="text" inputMode="numeric" className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.extraLeo === 0 ? "" : formatearPlata(nuevaFinanza.extraLeo)} onChange={e => handlePlataInput('extraLeo', e.target.value)} placeholder="0"/></div>
                        <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Extra Bruno ($)</label><input type="text" inputMode="numeric" className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.extraBruno === 0 ? "" : formatearPlata(nuevaFinanza.extraBruno)} onChange={e => handlePlataInput('extraBruno', e.target.value)} placeholder="0"/></div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="md:col-span-2 lg:col-span-1"><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Concepto</label><input ref={tipoInputRef} required className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.tramite} onChange={e => setNuevaFinanza({...nuevaFinanza, tramite: e.target.value})}/></div>
                      <div className="md:col-span-2 lg:col-span-1"><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Pagado por</label><select className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.encargado} onChange={e => setNuevaFinanza({...nuevaFinanza, encargado: e.target.value})}><option value="Leo">Leo</option><option value="Bruno">Bruno</option></select></div>
                      <div className="md:col-span-2 lg:col-span-2"><label className="text-xs uppercase tracking-wider font-bold text-red-500">Monto del Gasto ($)</label><input type="text" inputMode="numeric" required className="w-full border-b-2 border-red-900 bg-[#222222] p-3 rounded font-black text-red-400 focus:outline-none focus:border-red-500" value={nuevaFinanza.caja === 0 ? "" : formatearPlata(nuevaFinanza.caja)} onChange={e => handlePlataInput('caja', e.target.value)} placeholder="0"/><div className="text-[10px] md:text-xs tracking-wide text-zinc-500 mt-2">Se descontará 50% a cada uno automáticamente.</div></div>
                    </>
                  )}
                  <div className="col-span-1 md:col-span-2 lg:col-span-4 flex flex-col sm:flex-row justify-end gap-3 mt-4">
                    {editandoFinanzaId && (<button type="button" onClick={() => {setEditandoFinanzaId(null); setNuevaFinanza(estadoFinanzaInicial);}} className="w-full sm:w-auto px-6 py-3 rounded text-xs tracking-widest font-bold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 uppercase">Cancelar</button>)}
                    <button type="submit" className={`w-full sm:w-auto px-8 py-3 rounded text-white text-xs font-black tracking-widest uppercase shadow-md transition-colors ${editandoFinanzaId ? 'bg-orange-600 hover:bg-orange-500' : 'bg-[#727A4E] hover:bg-[#8B9461]'}`}>{editandoFinanzaId ? "GUARDAR" : "CARGAR"}</button>
                  </div>
                </form>
              </div>

              <div className="bg-[#222222] border border-[#727A4E]/30 rounded-xl shadow-2xl p-6 md:p-8 flex flex-col xl:flex-row items-center justify-between relative overflow-hidden gap-8">
                <div className="flex flex-col sm:flex-row gap-8 lg:gap-16 relative z-10 w-full xl:w-auto justify-around xl:justify-start">
                  <div className="text-center sm:text-left bg-[#1A1A1A] sm:bg-transparent p-4 sm:p-0 rounded-lg">
                    <h4 className="text-[#727A4E] font-black tracking-widest text-sm mb-3">RESUMEN LEO</h4>
                    <p className="text-sm mb-1 text-zinc-400">Cobrado: <span className="text-white font-medium">${formatearPlata(resumenActual.cobradoLeo)}</span></p>
                    <p className="text-sm mb-1 text-zinc-400">Limpio: <span className="text-white font-medium">${formatearPlata(resumenActual.limpioLeoTotal)}</span></p>
                    <p className="text-sm border-b border-zinc-700 pb-2 mb-2 text-zinc-400">Pagado Gral: <span className="text-white font-medium">${formatearPlata(resumenActual.gastosLeo)}</span></p>
                    <p className={`font-black text-lg md:text-xl tracking-wide ${resumenActual.balanceLeo > 0 ? 'text-red-400' : 'text-[#A4B070]'}`}>
                      {resumenActual.balanceLeo > 0 ? `Pagar: $${formatearPlata(resumenActual.balanceLeo)}` : `A favor: $${formatearPlata(Math.abs(resumenActual.balanceLeo))}`}
                    </p>
                  </div>
                  <div className="text-center sm:text-left bg-[#1A1A1A] sm:bg-transparent p-4 sm:p-0 rounded-lg">
                    <h4 className="text-[#727A4E] font-black tracking-widest text-sm mb-3">RESUMEN BRUNO</h4>
                    <p className="text-sm mb-1 text-zinc-400">Cobrado: <span className="text-white font-medium">${formatearPlata(resumenActual.cobradoBruno)}</span></p>
                    <p className="text-sm mb-1 text-zinc-400">Limpio: <span className="text-white font-medium">${formatearPlata(resumenActual.limpioBrunoTotal)}</span></p>
                    <p className="text-sm border-b border-zinc-700 pb-2 mb-2 text-zinc-400">Pagado Gral: <span className="text-white font-medium">${formatearPlata(resumenActual.gastosBruno)}</span></p>
                    <p className={`font-black text-lg md:text-xl tracking-wide ${resumenActual.balanceBruno > 0 ? 'text-red-400' : 'text-[#A4B070]'}`}>
                      {resumenActual.balanceBruno > 0 ? `Pagar: $${formatearPlata(resumenActual.balanceBruno)}` : `A favor: $${formatearPlata(Math.abs(resumenActual.balanceBruno))}`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full xl:w-auto items-center relative z-10">
                  <div className="w-full bg-[#1A1A1A] p-3 rounded-lg border border-zinc-800 text-center">
                    <label className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-[#727A4E] block mb-1">📎 Adjuntar Comprobante (Opcional)</label>
                    <input type="file" accept="image/*,application/pdf" onChange={e => setArchivoComprobante(e.target.files?.[0] || null)} className="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#727A4E] file:text-white hover:file:bg-[#8B9461] cursor-pointer w-full"/>
                  </div>
                  <button onClick={liquidarSemana} className="w-full bg-[#727A4E] text-white hover:bg-[#8B9461] px-8 py-4 rounded font-black text-sm uppercase tracking-widest shadow-lg border border-[#8B9461]">CERRAR SEMANA</button>
                </div>
              </div>

              <div className="bg-[#1A1A1A] rounded-xl shadow-lg overflow-hidden border border-zinc-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap min-w-[800px]">
                    <thead><tr className="bg-[#222222] text-[#727A4E] font-bold uppercase text-xs tracking-wider border-b border-zinc-800"><th className="p-4">Tipo</th><th className="p-4">Propietario / Pagó</th><th className="p-4">Ingreso / Costo</th><th className="p-4">Gastos Trámite</th><th className="p-4 text-zinc-300">Limpio Leo</th><th className="p-4 text-zinc-300">Limpio Bruno</th><th className="p-4 w-16">Acción</th></tr></thead>
                    <tbody>
                      {finanzas.map((f: any) => {
                        const partes = calcularPartes(f);
                        return (
                          <tr key={f.id} className={`border-b border-zinc-800 hover:bg-[#2A2A2A] ${f.es_gasto_5050 ? 'bg-[#1E1E1E]' : ''}`}>
                            <td className="p-4 font-bold text-zinc-200">{f.tipo_tramite} {f.es_gasto_5050 && <span className="ml-2 text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded uppercase tracking-wider">50/50</span>}{!f.es_gasto_5050 && f.tipo_pago && <span className={`ml-2 text-[10px] px-2 py-1 rounded uppercase tracking-wider ${f.tipo_pago === "saldo" ? "bg-yellow-900/30 text-yellow-400" : f.tipo_pago === "gastos" ? "bg-red-900/30 text-red-400" : "bg-[#727A4E]/20 text-[#A4B070]"}`}>{f.tipo_pago}</span>}</td>
                            <td className="p-4 text-zinc-400">{f.es_gasto_5050 ? <span className="font-bold text-zinc-300">Pagó {f.encargado}</span> : f.propietario}</td>
                            <td className={`p-4 font-black ${f.es_gasto_5050 || f.tipo_pago === "gastos" ? 'text-red-400' : 'text-[#A4B070]'}`}>${formatearPlata(f.es_gasto_5050 ? f.caja : f.tipo_pago === "gastos" ? partes.totalAportes : f.ingreso_total)}</td>
                            <td className="p-4 text-zinc-500">{f.es_gasto_5050 ? '-' : `$${formatearPlata(partes.totalAportes)}`}</td>
                            <td className={`p-4 font-bold ${f.es_gasto_5050 || partes.limpioLeo < 0 ? 'text-red-500' : 'text-zinc-200'}`}>${formatearPlata(f.es_gasto_5050 ? -Math.round(Number(f.caja) / 2) : partes.limpioLeo)}</td>
                            <td className={`p-4 font-bold ${f.es_gasto_5050 || partes.limpioBruno < 0 ? 'text-red-500' : 'text-zinc-200'}`}>${formatearPlata(f.es_gasto_5050 ? -Math.round(Number(f.caja) / 2) : partes.limpioBruno)}</td>
                            <td className="p-4 flex gap-3">
                              <button onClick={() => iniciarEdicionFinanza(f)} className="text-lg opacity-40 hover:opacity-100" title="Editar">✏️</button>
                              <button onClick={() => eliminarFinanza(f.id)} className="text-lg opacity-40 hover:opacity-100" title="Borrar">🗑️</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {subTabFinanzas === "historial" && (
            <div className="space-y-4">
              <h3 className="text-lg font-black tracking-widest text-white mb-4 uppercase">Historial de Finanzas Liquidadas</h3>

              <div className="bg-[#1A1A1A] rounded-xl border border-zinc-800 p-4 space-y-3">
                <div className="flex flex-col w-full sm:w-72">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1">Buscar propietario</label>
                  <div className="relative">
                    <input type="text" placeholder="Ej: Perez" value={busquedaHistorial} onChange={e => setBusquedaHistorial(e.target.value)}
                      className="w-full bg-[#222] border border-zinc-700 text-white p-2 pr-8 rounded text-xs font-bold tracking-wider focus:outline-none focus:border-[#727A4E]" />
                    {buscandoHistorial && (
                      <button type="button" onClick={() => setBusquedaHistorial("")} title="Borrar búsqueda"
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-400 hover:text-white text-sm">✕</button>
                    )}
                  </div>
                </div>

                {buscandoHistorial && (
                  <div className="space-y-2 text-xs text-zinc-400">
                    <p>
                      {ingresosCoincidencias.length} {ingresosCoincidencias.length === 1 ? "registro liquidado" : "registros liquidados"} · Total ingresado:{" "}
                      <span className="text-[#A4B070] font-black text-sm">${formatearPlata(entregadoBusqueda)}</span>
                    </p>
                    {entregadoPorPropietario.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {entregadoPorPropietario.map(({ nombre, total }) => (
                          <span key={nombre} className="bg-[#222] border border-zinc-700 rounded px-2 py-1 text-[11px]">
                            <span className="text-zinc-300 font-bold">{nombre}</span> ${formatearPlata(total)}
                          </span>
                        ))}
                      </div>
                    )}
                    {semanaActualCoincidencias.length > 0 && (
                      <p className="text-yellow-400/90">
                        Además, en la semana actual (sin liquidar): {semanaActualCoincidencias.length} {semanaActualCoincidencias.length === 1 ? "registro" : "registros"} por ${formatearPlata(entregadoSemanaActual)}
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              {aniosFinanzasOrdenados.length === 0 ? (
                <p className="p-8 text-center text-zinc-500 font-bold tracking-widest uppercase bg-[#1A1A1A] rounded-xl border border-zinc-800">{buscandoHistorial ? "No se encontraron registros liquidados de ese propietario" : "No hay historial de finanzas"}</p>
              ) : (
                <div className="space-y-4">
                  {aniosFinanzasOrdenados.map(anio => {
                    const mesesDelAnio = Object.keys(historialVisible[anio]).sort((a, b) => b.localeCompare(a));
                    const anioFinAbierto = buscandoHistorial || aniosFinanzasAbiertos[anio];
                    return (
                      <div key={anio} className="bg-[#1A1A1A] rounded-xl shadow-lg overflow-hidden border border-zinc-800">
                        <div onClick={() => toggleAnioFinanzas(anio)} className="bg-[#222222] p-4 border-b border-zinc-800 flex justify-between cursor-pointer hover:bg-[#2A2A2A] transition-colors select-none">
                          <h4 className="font-bold text-white uppercase tracking-widest text-sm md:text-base flex items-center gap-2">
                            <span className="text-[#727A4E] text-xs">{anioFinAbierto ? '▼' : '▶'}</span> AÑO {anio}
                          </h4>
                          <span className="text-[#727A4E] font-bold text-sm bg-[#111] px-3 py-1 rounded-full border border-zinc-700">
                            {Object.values(historialVisible[anio]).map((m: any) => Object.values(m).flat()).flat().length} Registros
                          </span>
                        </div>

                        {anioFinAbierto && (
                          <div className="p-3 space-y-3">
                            {mesesDelAnio.map(mesNum => {
                              const keyMesFinanza = `${anio}-${mesNum}`;
                              const semanasDelMes = historialVisible[anio][mesNum];
                              const mesFinAbierto = buscandoHistorial || mesesFinanzasAbiertos[keyMesFinanza];
                              const nombresSemanas = Object.keys(semanasDelMes).sort((a, b) => {
                                if (a === "anterior") return 1;
                                if (b === "anterior") return -1;
                                return new Date(b).getTime() - new Date(a).getTime();
                              });
                              const nombreMes = nombresMeses[mesNum] || mesNum;

                              return (
                                <div key={keyMesFinanza} className="bg-[#161616] rounded-lg overflow-hidden border border-zinc-800 ml-2 md:ml-4">
                                  <div onClick={() => toggleMesFinanzas(keyMesFinanza)} className="p-3 bg-[#1D1D1D] flex justify-between cursor-pointer hover:bg-[#252525] select-none">
                                    <span className="font-bold text-zinc-300 uppercase tracking-wider text-xs flex items-center gap-2">
                                      <span className="text-[#727A4E] text-[10px]">{mesFinAbierto ? '▼' : '▶'}</span> {nombreMes}
                                    </span>
                                    <span className="text-xs text-zinc-500 font-bold">{nombresSemanas.length} Semanas</span>
                                  </div>

                                  {mesFinAbierto && (
                                    <div className="p-3 space-y-3">
                                      {nombresSemanas.map(fechaKey => {
                                        const trabajosDelBloque = semanasDelMes[fechaKey];
                                        const tituloBloque = fechaKey === "anterior" ? "Liquidaciones Anteriores (Sin fecha)" : `Liq. ${new Date(fechaKey).toLocaleDateString("es-AR")}`;
                                        const estaAbierto = buscandoHistorial || semanasAbiertas[fechaKey] || false;
                                        const bloqueCompleto = historialAgrupado[anio][mesNum][fechaKey];
                                        const resumenBloque = generarResumen(bloqueCompleto);
                                        const comprobanteUrl = bloqueCompleto.find((item: any) => item.comprobante_url)?.comprobante_url;

                                        return (
                                          <div key={fechaKey} className="bg-[#111111] rounded-xl shadow-md overflow-hidden border border-zinc-800 ml-2 md:ml-4">
                                            <div className="bg-[#1F1F1F] p-3 md:p-4 border-b border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center text-white gap-3 md:gap-0">
                                              <h5 onClick={() => toggleHistorial(fechaKey)} className="font-bold text-xs md:text-sm cursor-pointer flex-1 tracking-widest uppercase flex items-center gap-2 hover:text-[#727A4E] w-full">
                                                {tituloBloque} 
                                                {comprobanteUrl && <span className="bg-blue-900/40 text-blue-300 border border-blue-700/50 text-[9px] px-2 py-0.5 rounded font-bold">📎 Con Comprobante</span>}
                                                <span className="text-zinc-400 text-[10px] font-bold px-2 py-0.5 bg-[#111] rounded border border-zinc-700 ml-auto md:ml-0">({trabajosDelBloque.length}) {estaAbierto ? '▼' : '▶'}</span>
                                              </h5>
                                              {!buscandoHistorial && (
                                                <div className="flex gap-2 w-full md:w-auto justify-end">
                                                  <button onClick={() => reabrirSemana(fechaKey)} className="bg-transparent border border-zinc-600 hover:border-zinc-400 text-zinc-300 hover:text-white px-3 py-1 text-[10px] tracking-wider font-bold rounded uppercase">Reabrir</button>
                                                  <button onClick={() => eliminarSemana(fechaKey)} className="bg-red-900/25 hover:bg-red-900/60 border border-red-900/50 text-red-400 px-3 py-1 text-[10px] tracking-wider font-bold rounded uppercase">Borrar</button>
                                                </div>
                                              )}
                                            </div>
                                            
                                            {estaAbierto && (
                                              <div>
                                                <div className="bg-[#1A1A1A] p-4 border-b border-zinc-800 flex flex-col lg:flex-row gap-6 justify-between items-center">
                                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:w-auto flex-1">
                                                    <div className="bg-[#222] p-3 rounded-lg border border-zinc-800 text-center sm:text-left">
                                                      <span className="text-[10px] font-black tracking-widest text-[#727A4E] block mb-1">SOCIO LEO (SEMANA)</span>
                                                      <p className="text-xs text-zinc-400 mb-1">Limpio Gen.: <span className="text-white font-bold">${formatearPlata(resumenBloque.limpioLeoTotal)}</span></p>
                                                      <p className={`text-sm font-black ${resumenBloque.balanceLeo > 0 ? 'text-red-400' : 'text-[#A4B070]'}`}>
                                                        {resumenBloque.balanceLeo > 0 ? `Transfirió: $${formatearPlata(resumenBloque.balanceLeo)}` : `Recibió: $${formatearPlata(Math.abs(resumenBloque.balanceLeo))}`}
                                                      </p>
                                                    </div>
                                                    <div className="bg-[#222] p-3 rounded-lg border border-zinc-800 text-center sm:text-left">
                                                      <span className="text-[10px] font-black tracking-widest text-[#727A4E] block mb-1">SOCIO BRUNO (SEMANA)</span>
                                                      <p className="text-xs text-zinc-400 mb-1">Limpio Gen.: <span className="text-white font-bold">${formatearPlata(resumenBloque.limpioBrunoTotal)}</span></p>
                                                      <p className={`text-sm font-black ${resumenBloque.balanceBruno > 0 ? 'text-red-400' : 'text-[#A4B070]'}`}>
                                                        {resumenBloque.balanceBruno > 0 ? `Transfirió: $${formatearPlata(resumenBloque.balanceBruno)}` : `Recibió: $${formatearPlata(Math.abs(resumenBloque.balanceBruno))}`}
                                                      </p>
                                                    </div>
                                                  </div>

                                                  {comprobanteUrl && (
                                                    <div className="flex flex-col items-center justify-center bg-[#222] p-3 rounded-lg border border-zinc-800 w-full lg:w-40">
                                                      <span className="text-[9px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">Comprobante</span>
                                                      <a href={comprobanteUrl} target="_blank" rel="noreferrer" className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-800/50 px-3 py-1.5 rounded text-[10px] tracking-wider font-bold uppercase text-center w-full">
                                                        🔍 Ver Imagen
                                                      </a>
                                                    </div>
                                                  )}
                                                </div>

                                                <div className="overflow-x-auto">
                                                  <table className="w-full text-left whitespace-nowrap min-w-[700px]">
                                                    <thead><tr className="bg-[#1A1A1A] text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800"><th className="p-3">Tipo</th><th className="p-3">Propietario</th><th className="p-3">Entró Por</th><th className="p-3">Total/Gasto</th><th className="p-3">Limpio Leo</th><th className="p-3">Limpio Bruno</th></tr></thead>
                                                    <tbody>
                                                      {trabajosDelBloque.map((h: any) => {
                                                        const partes = calcularPartes(h);
                                                        return (
                                                          <tr key={h.id} className={`border-b border-zinc-800 text-xs ${h.es_gasto_5050 ? 'bg-[#181818]' : ''}`}>
                                                            <td className="p-3 font-bold text-zinc-300">{h.tipo_tramite} {h.es_gasto_5050 && <span className="ml-2 text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">50/50</span>}{!h.es_gasto_5050 && h.tipo_pago && <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded uppercase ${h.tipo_pago === "saldo" ? "bg-yellow-900/30 text-yellow-400" : h.tipo_pago === "gastos" ? "bg-red-900/30 text-red-400" : "bg-[#727A4E]/20 text-[#A4B070]"}`}>{h.tipo_pago}</span>}</td>
                                                            <td className="p-3 text-zinc-400">{h.es_gasto_5050 ? `Pagó ${h.encargado}` : h.propietario}</td>
                                                            <td className="p-3 text-zinc-500">{h.es_gasto_5050 ? '-' : h.encargado}</td>
                                                            <td className={`p-3 font-bold ${h.es_gasto_5050 || h.tipo_pago === "gastos" ? 'text-red-400' : 'text-zinc-300'}`}>${formatearPlata(h.es_gasto_5050 ? h.caja : h.tipo_pago === "gastos" ? partes.totalAportes : h.ingreso_total)}</td>
                                                            <td className="p-3 text-zinc-400">${formatearPlata(h.es_gasto_5050 ? -Math.round(Number(h.caja) / 2) : partes.limpioLeo)}</td>
                                                            <td className="p-3 text-zinc-400">${formatearPlata(h.es_gasto_5050 ? -Math.round(Number(h.caja) / 2) : partes.limpioBruno)}</td>
                                                          </tr>
                                                        );
                                                      })}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA: REVISOR DE PLANOS */}
      {activeTab === "planos" && (
        <div className="space-y-6">
          <div className="bg-[#1A1A1A] p-4 rounded-xl border border-zinc-800">
            <h2 className="text-lg md:text-xl font-black tracking-widest text-white uppercase mb-4">📐 Revisor de Planos de Mensura</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block mb-1">Vincular a expediente (opcional)</label>
                <select value={expedientePlano} onChange={e => setExpedientePlano(e.target.value)} className="w-full bg-[#111111] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#727A4E]">
                  <option value="">Sin vincular</option>
                  {trabajosActivos.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.tipo ? `${t.tipo} - ${t.propietario}` : t.nombre_expediente}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block mb-1">Plano (PDF)</label>
                <input key={`plano-${claveArchivosPlano}`} type="file" accept="application/pdf" onChange={e => setArchivoPlano(e.target.files?.[0] || null)} className="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#727A4E] file:text-white hover:file:bg-[#8B9461] cursor-pointer w-full"/>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block mb-1">Escritura (PDF, opcional)</label>
                <input key={`escritura-${claveArchivosPlano}`} type="file" accept="application/pdf" onChange={e => setArchivoEscritura(e.target.files?.[0] || null)} className="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-700 file:text-white hover:file:bg-zinc-600 cursor-pointer w-full"/>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block mb-1">Set de datos (PDF, opcional)</label>
                <input key={`set-${claveArchivosPlano}`} type="file" accept="application/pdf" onChange={e => setArchivoSet(e.target.files?.[0] || null)} className="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-700 file:text-white hover:file:bg-zinc-600 cursor-pointer w-full"/>
              </div>
              <button onClick={revisarPlano} disabled={revisandoPlano || !archivoPlano} className="md:col-span-2 bg-[#727A4E] hover:bg-[#8B9461] disabled:opacity-50 text-white font-black py-3 px-6 rounded-lg shadow-lg text-sm uppercase tracking-widest">
                {revisandoPlano ? "Analizando plano..." : "Revisar Plano"}
              </button>
            </div>
            <p className="text-zinc-600 text-[11px] mt-3">Con la escritura y el set de datos (Informe Catastral) el revisor también contrasta nombres, superficies, linderos y nomenclatura contra el documento. Entre todos los archivos, hasta 4 MB.</p>
            {revisandoPlano && <p className="text-zinc-500 text-xs mt-3">Puede tardar 2-4 minutos: Claude lee el plano y los documentos completos antes de responder.</p>}
            {errorPlano && <p className="text-red-400 text-xs font-bold mt-3">{errorPlano}</p>}
          </div>

          {resultadoPlanoActual && (
            <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#727A4E]/40 space-y-6">
              <div>
                <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-2">Resultado</h3>
                <p className="text-zinc-300 text-sm">{resultadoPlanoActual.resumen}</p>
                {resultadoPlanoActual.documentos && (
                  <p className="text-zinc-500 text-xs mt-2">
                    Contrastado con: {[resultadoPlanoActual.documentos.escritura && "escritura", resultadoPlanoActual.documentos.set && "set de datos"].filter(Boolean).join(" y ") || "ningún documento (solo el plano)"}
                  </p>
                )}
                {resultadoPlanoActual.incompleto && (
                  <p className="text-yellow-400 text-xs font-bold mt-2">⚠️ El análisis se cortó por {resultadoPlanoActual.motivo_corte === "tiempo" ? "tiempo" : "largo"} antes de terminar: estos son los hallazgos que alcanzó a escribir. Volvé a correrlo si falta algo.</p>
                )}
              </div>

              {(resultadoPlanoActual.checklist || []).length > 0 && (
                <div>
                  <h4 className="text-zinc-400 font-bold uppercase tracking-wider text-xs mb-2">Checklist ({ITEMS_CHECKLIST.length} puntos)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {resultadoPlanoActual.checklist.map((c: any, i: number) => {
                      const meta = ITEMS_CHECKLIST.find((it) => it.id === c.id);
                      const icono = c.estado === "ok" ? "✅" : c.estado === "advertencia" ? "⚠️" : c.estado === "error" ? "❌" : "➖";
                      const color = c.estado === "ok" ? "text-emerald-400" : c.estado === "advertencia" ? "text-yellow-400" : c.estado === "error" ? "text-red-400" : "text-zinc-600";
                      return (
                        <div key={i} className="flex gap-2 items-start bg-[#111111] p-2.5 rounded border border-zinc-800">
                          <span className="shrink-0">{icono}</span>
                          <div className="min-w-0">
                            <div className={`text-xs font-bold ${color}`}>{meta?.item || c.id}</div>
                            {c.comentario && <div className="text-xs text-zinc-500 mt-0.5">{c.comentario}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-zinc-400 font-bold uppercase tracking-wider text-xs mb-2">{(resultadoPlanoActual.checklist || []).length > 0 ? "Hallazgos puntuales adicionales" : "Hallazgos"}</h4>
                {(resultadoPlanoActual.hallazgos || []).length === 0 ? (
                  <p className="text-emerald-400 text-sm font-bold">✅ Sin hallazgos.</p>
                ) : (
                  <div className="space-y-2">
                    {resultadoPlanoActual.hallazgos.map((h: any, i: number) => {
                      const nivel = h.severidad || h.confianza;
                      const color = nivel === "alta" ? "border-red-700/50 bg-red-900/20 text-red-300" : nivel === "media" ? "border-yellow-700/50 bg-yellow-900/20 text-yellow-300" : "border-zinc-700 bg-zinc-800/40 text-zinc-300";
                      return (
                        <div key={i} className={`p-3 rounded border ${color}`}>
                          <div className="text-[10px] uppercase tracking-wider font-bold mb-1 opacity-80">{ETIQUETA_CATEGORIA_PLANO[h.categoria] || h.categoria} {h.confianza ? `· confianza ${h.confianza}` : ""} {h.articulo ? `· ${h.articulo}` : ""} {h.ubicacion ? `· ${h.ubicacion}` : ""}</div>
                          <div className="text-sm">{h.descripcion}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-[#1A1A1A] rounded-xl border border-zinc-800 overflow-hidden">
            <h3 className="text-white font-bold uppercase tracking-wider text-sm p-4 border-b border-zinc-800">Historial de revisiones</h3>
            {revisionesPlanos.length === 0 ? (
              <p className="text-zinc-500 text-sm p-4">Todavía no se revisó ningún plano.</p>
            ) : (
              <div className="divide-y divide-zinc-800">
                {revisionesPlanos.map((r: any) => {
                  const expediente = trabajosActivos.find((t: any) => t.id === r.expediente_id) || trabajosFinalizados.find((t: any) => t.id === r.expediente_id);
                  const checklist = r.resultado?.checklist || [];
                  const cantOk = checklist.filter((c: any) => c.estado === "ok").length;
                  const cantError = checklist.filter((c: any) => c.estado === "error").length;
                  const cantAdvertencia = checklist.filter((c: any) => c.estado === "advertencia").length;
                  return (
                    <details key={r.id} className="p-4">
                      <summary className="cursor-pointer flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                        <span className="text-zinc-500 text-xs">{new Date(r.creado_en).toLocaleString("es-AR")}</span>
                        <span className="font-bold text-white">{r.nombre_archivo}</span>
                        {expediente && <span className="text-[#A4B070] text-xs">({expediente.tipo ? `${expediente.tipo} - ${expediente.propietario}` : expediente.nombre_expediente})</span>}
                        {checklist.length > 0 && (
                          <span className="text-xs whitespace-nowrap">✅ {cantOk} · ⚠️ {cantAdvertencia} · ❌ {cantError}</span>
                        )}
                        <a href={r.archivo_url} target="_blank" rel="noreferrer" className="text-blue-400 text-xs hover:underline ml-auto">Ver PDF</a>
                      </summary>
                      <p className="text-zinc-400 text-xs mt-2">{r.resultado?.resumen}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mt-2">
                        {checklist.map((c: any, i: number) => {
                          const meta = ITEMS_CHECKLIST.find((it) => it.id === c.id);
                          const icono = c.estado === "ok" ? "✅" : c.estado === "advertencia" ? "⚠️" : c.estado === "error" ? "❌" : "➖";
                          return (
                            <div key={i} className="text-xs text-zinc-400 flex gap-1.5">
                              <span className="shrink-0">{icono}</span>
                              <span>{meta?.item || c.id}{c.comentario ? ` — ${c.comentario}` : ""}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="space-y-2 mt-3">
                        {(r.resultado?.hallazgos || []).map((h: any, i: number) => (
                          <div key={i} className="text-xs text-zinc-400">• [{ETIQUETA_CATEGORIA_PLANO[h.categoria] || h.categoria}{h.confianza ? ` · ${h.confianza}` : ""}] {h.descripcion}</div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
