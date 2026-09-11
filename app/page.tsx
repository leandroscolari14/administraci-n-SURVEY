"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const telegramBotToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || "";
const telegramChatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || "";

export default function DashboardAgrimensura() {
  const [activeTab, setActiveTab] = useState("trabajos");
  const [subTabTrabajos, setSubTabTrabajos] = useState("activos");
  
  // Estados para las listas contraíbles de los expedientes
  const [leoAbierto, setLeoAbierto] = useState(false);
  const [brunoAbierto, setBrunoAbierto] = useState(false);
  
  const [trabajosActivos, setTrabajosActivos] = useState<any[]>([]);
  const [trabajosFinalizados, setTrabajosFinalizados] = useState<any[]>([]);
  const [finanzas, setFinanzas] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [mediciones, setMediciones] = useState<any[]>([]);
  
  const [catastro, setCatastro] = useState({ usuario: "Libre", fecha: "" });
  const [tiempoUso, setTiempoUso] = useState("");
  const [semanasAbiertas, setSemanasAbiertas] = useState<Record<string, boolean>>({});
  const tipoInputRef = useRef<HTMLInputElement>(null);

  const [nuevoTrabajo, setNuevoTrabajo] = useState({ nombre: "", estado: "", color: "verde", encargado: "Leo" });
  const [editandoTrabajoId, setEditandoTrabajoId] = useState<string | null>(null);
  
  const [editandoFinanzaId, setEditandoFinanzaId] = useState<string | null>(null);
  const [nuevaFinanza, setNuevaFinanza] = useState({ tramite: "VEP", propietario: "", encargado: "Leo", ingreso: 0, caja: 83000, colegio: 69300, extraLeo: 20800, extraBruno: 0, esGasto5050: false });

  const hoy = new Date().toISOString().split('T')[0];
  const [nuevaMedicion, setNuevaMedicion] = useState({ titulo: "", fecha: hoy, hora: "14:00", ubicacion: "" });

  const [filtroEncargado, setFiltroEncargado] = useState("Todos");
  const [filtroTexto, setFiltroTexto] = useState("");

  useEffect(() => { cargarDatos(); }, []);

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

  const cargarDatos = async () => {
    const { data: dataTrabajosActivos } = await supabase.from("trabajos_curso").select("*").eq("finalizado", false).order("fecha_actualizacion", { ascending: false });
    const { data: dataTrabajosFin } = await supabase.from("trabajos_curso").select("*").eq("finalizado", true).order("fecha_finalizacion", { ascending: false });
    
    const { data: dataFinanzas } = await supabase.from("finanzas").select("*").eq("liquidado", false).order("fecha_carga", { ascending: false });
    const { data: dataHistorial } = await supabase.from("finanzas").select("*").eq("liquidado", true).order("fecha_liquidacion", { ascending: false });
    const { data: dataCatastro } = await supabase.from("estado_catastro").select("*").limit(1);
    const { data: dataMediciones } = await supabase.from("mediciones").select("*").eq("estado", "pendiente").order("fecha", { ascending: true }).order("hora", { ascending: true });
    
    if (dataTrabajosActivos) setTrabajosActivos(dataTrabajosActivos);
    if (dataTrabajosFin) setTrabajosFinalizados(dataTrabajosFin);
    if (dataFinanzas) setFinanzas(dataFinanzas);
    if (dataHistorial) setHistorial(dataHistorial);
    if (dataCatastro && dataCatastro.length > 0) setCatastro({ usuario: dataCatastro[0].usuario, fecha: dataCatastro[0].fecha_actualizacion });
    if (dataMediciones) setMediciones(dataMediciones);
  };

  const enviarTelegram = async (mensaje: string) => {
    if (!telegramBotToken || !telegramChatId) return;
    const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
    try { await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: telegramChatId, text: mensaje, parse_mode: "Markdown" }) }); } catch (error) { console.error(error); }
  };

  const tomarCatastro = async (nombre: string) => {
    const nuevaFecha = new Date().toISOString();
    await supabase.from("estado_catastro").update({ usuario: nombre, fecha_actualizacion: nuevaFecha }).eq("id", 1);
    cargarDatos();
    await enviarTelegram(`🔴 *SISTEMA EN USO*\n\n**${nombre}** acaba de entrar al sistema SCIT de Catastro.`);
  };

  const liberarCatastro = async () => {
    await supabase.from("estado_catastro").update({ usuario: "Libre", fecha_actualizacion: new Date().toISOString() }).eq("id", 1);
    cargarDatos();
    await enviarTelegram(`🟢 *SISTEMA LIBERADO*\n\nEl sistema SCIT ya está disponible nuevamente.`);
  };

  const formatearPlata = (monto: any) => new Intl.NumberFormat("es-AR").format(Number(monto));
  const handlePlataInput = (campo: string, valorStr: string) => { const valorLimpio = valorStr.replace(/\D/g, ''); setNuevaFinanza({ ...nuevaFinanza, [campo]: Number(valorLimpio) }); };
  
  const actualizarValoresFinanza = (campo: string, valor: string) => {
    let nuevoTramite = campo === 'tramite' ? valor : nuevaFinanza.tramite;
    let nuevoEncargado = campo === 'encargado' ? valor : nuevaFinanza.encargado;
    let eLeo = 0, eBruno = 0;
    const esREP = nuevoTramite.toUpperCase().includes("REP");
    if (nuevoEncargado === "Leo") { eLeo = 20800; eBruno = esREP ? 11700 : 0; } else { eLeo = 0; eBruno = esREP ? (20800 + 11700) : 20800; }
    setNuevaFinanza({ ...nuevaFinanza, [campo]: valor, extraLeo: eLeo, extraBruno: eBruno });
  };

  const toggleGasto5050 = () => {
    if (!nuevaFinanza.esGasto5050) setNuevaFinanza({ ...nuevaFinanza, esGasto5050: true, tramite: "Cuota CAJA", ingreso: 0, caja: 0, colegio: 0, extraLeo: 0, extraBruno: 0, propietario: "-" });
    else setNuevaFinanza({ ...nuevaFinanza, esGasto5050: false, tramite: "VEP", propietario: "", ingreso: 0, caja: 83000, colegio: 69300, extraLeo: 20800, extraBruno: 0 });
  };

  const guardarTrabajo = async (e: any) => {
    e.preventDefault();
    if (editandoTrabajoId) {
      await supabase.from("trabajos_curso").update({ nombre_expediente: nuevoTrabajo.nombre, estado_detalle: nuevoTrabajo.estado, color_alerta: nuevoTrabajo.color, encargado: nuevoTrabajo.encargado }).eq("id", editandoTrabajoId);
      setEditandoTrabajoId(null);
    } else {
      await supabase.from("trabajos_curso").insert([{ nombre_expediente: nuevoTrabajo.nombre, estado_detalle: nuevoTrabajo.estado, color_alerta: nuevoTrabajo.color, encargado: nuevoTrabajo.encargado }]);
    }
    setNuevoTrabajo({ nombre: "", estado: "", color: "verde", encargado: "Leo" });
    cargarDatos();
  };

  const iniciarEdicionTrabajo = (t: any) => {
    setEditandoTrabajoId(t.id);
    setNuevoTrabajo({ nombre: t.nombre_expediente, estado: t.estado_detalle, color: t.color_alerta, encargado: t.encargado || "Leo" });
    if (t.encargado === "Leo") setLeoAbierto(true);
    if (t.encargado === "Bruno") setBrunoAbierto(true);
  };

  const toggleEtapa = async (id: string, etapa: string, valorActual: boolean) => {
    await supabase.from("trabajos_curso").update({ [etapa]: !valorActual }).eq("id", id);
    cargarDatos();
  };

  const finalizarTrabajo = async (t: any) => {
    if (confirm(`¿Marcar el expediente "${t.nombre_expediente}" como FINALIZADO y enviarlo al historial?`)) {
      await supabase.from("trabajos_curso").update({ finalizado: true, fecha_finalizacion: new Date().toISOString().split('T')[0] }).eq("id", t.id);
      cargarDatos();
    }
  };

  const eliminarTrabajo = async (id: string) => {
    if (confirm("🚨 ATENCIÓN: ¿Estás seguro de borrar DEFINITIVAMENTE este expediente? Esta acción no se puede deshacer.")) {
      await supabase.from("trabajos_curso").delete().eq("id", id);
      cargarDatos();
    }
  };

  const guardarMedicion = async (e: any) => {
    e.preventDefault();
    const { error } = await supabase.from("mediciones").insert([{ titulo: nuevaMedicion.titulo, fecha: nuevaMedicion.fecha, hora: nuevaMedicion.hora, ubicacion: nuevaMedicion.ubicacion }]);
    if (error) return alert(`Error al guardar: ${error.message}`);
    const [anio, mes, dia] = nuevaMedicion.fecha.split("-");
    await enviarTelegram(`📐 *NUEVA MEDICIÓN PROGRAMADA*\n\n**Expediente:** ${nuevaMedicion.titulo}\n**Fecha:** ${dia}/${mes}/${anio} a las ${nuevaMedicion.hora}hs\n**Lugar:** ${nuevaMedicion.ubicacion}`);
    setNuevaMedicion({ titulo: "", fecha: hoy, hora: "14:00", ubicacion: "" });
    cargarDatos();
  };

  const completarMedicion = async (id: string) => { if (confirm("¿Marcar medición completada?")) { await supabase.from("mediciones").update({ estado: "completado" }).eq("id", id); cargarDatos(); } };
  const borrarMedicion = async (id: string) => { if (confirm("¿Borrar medición?")) { await supabase.from("mediciones").delete().eq("id", id); cargarDatos(); } };
  
  const generarLinkCalendar = (m: any) => {
    const fechaInicio = new Date(`${m.fecha}T${m.hora}:00-03:00`);
    const fechaFin = new Date(fechaInicio.getTime() + (2 * 60 * 60 * 1000));
    const f = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const invitados = "bruno.verga@email.com,leo.scolari@email.com"; 
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`📐 Medición: ${m.titulo}`)}&dates=${f(fechaInicio)}/${f(fechaFin)}&location=${encodeURIComponent(m.ubicacion)}&details=${encodeURIComponent(`Turno SURVEY.`)}&add=${invitados}`;
  };

  const guardarFinanza = async (e: any) => {
    e.preventDefault();
    const datosGuardar = { tipo_tramite: nuevaFinanza.tramite, propietario: nuevaFinanza.propietario, encargado: nuevaFinanza.encargado, ingreso_total: nuevaFinanza.ingreso, caja: nuevaFinanza.caja, colegio: nuevaFinanza.colegio, extra_leo: nuevaFinanza.extraLeo, extra_bruno: nuevaFinanza.extraBruno, es_gasto_5050: nuevaFinanza.esGasto5050 };
    if (editandoFinanzaId) { await supabase.from("finanzas").update(datosGuardar).eq("id", editandoFinanzaId); setEditandoFinanzaId(null); } 
    else await supabase.from("finanzas").insert([datosGuardar]);
    setNuevaFinanza({ tramite: "VEP", propietario: "", encargado: "Leo", ingreso: 0, caja: 83000, colegio: 69300, extraLeo: 20800, extraBruno: 0, esGasto5050: false });
    cargarDatos();
    setTimeout(() => { tipoInputRef.current?.focus(); }, 100);
  };
  const iniciarEdicionFinanza = (f: any) => { setEditandoFinanzaId(f.id); setNuevaFinanza({ tramite: f.tipo_tramite, propietario: f.propietario, encargado: f.encargado, ingreso: Number(f.ingreso_total), caja: Number(f.caja), colegio: Number(f.colegio), extraLeo: Number(f.extra_leo || 0), extraBruno: Number(f.extra_bruno || 0), esGasto5050: f.es_gasto_5050 || false }); };
  const eliminarFinanza = async (id: string) => { if (confirm("¿Borrar registro?")) { await supabase.from("finanzas").delete().eq("id", id); cargarDatos(); } };
  const liquidarSemana = async () => { if (finanzas.length === 0) return alert("Nada para liquidar."); if (confirm("¿Liquidar semana?")) { const ids = finanzas.map(f => f.id); await supabase.from("finanzas").update({ liquidado: true, fecha_liquidacion: new Date().toISOString() }).in("id", ids); cargarDatos(); } };
  const reabrirSemana = async (fechaKey: string) => { if (finanzas.length > 0) return alert("Liquidá la actual primero."); if (confirm("¿Reabrir?")) { if (fechaKey === "anterior") await supabase.from("finanzas").update({ liquidado: false }).is("fecha_liquidacion", null).eq("liquidado", true); else await supabase.from("finanzas").update({ liquidado: false, fecha_liquidacion: null }).eq("fecha_liquidacion", fechaKey); await cargarDatos(); setActiveTab("finanzas"); } };
  const eliminarSemana = async (fechaKey: string) => { if (confirm("¿Borrar historial?")) { if (fechaKey === "anterior") await supabase.from("finanzas").delete().is("fecha_liquidacion", null).eq("liquidado", true); else await supabase.from("finanzas").delete().eq("fecha_liquidacion", fechaKey); cargarDatos(); } };

  const calcularPartes = (f: any) => {
    if (f.es_gasto_5050) return { totalAportes: Number(f.caja), limpioLeo: 0, limpioBruno: 0 };
    const totalAportes = Number(f.caja) + Number(f.colegio) + Number(f.extra_leo || 0) + Number(f.extra_bruno || 0);
    const limpio = Number(f.ingreso_total) - totalAportes;
    return { 
      totalAportes: Math.round(totalAportes), 
      limpioLeo: Math.round(f.encargado === "Leo" ? limpio * 0.70 : limpio * 0.30), 
      limpioBruno: Math.round(f.encargado === "Bruno" ? limpio * 0.70 : limpio * 0.30) 
    };
  };

  const generarResumen = (lista: any[]) => {
    let cobradoLeo = 0, cobradoBruno = 0, gastosSalientesLeo = 0, gastosSalientesBruno = 0, gananciaPuraLeo = 0, gananciaPuraBruno = 0, deuda5050Leo = 0, deuda5050Bruno = 0;
    lista.forEach(f => {
      if (f.es_gasto_5050) { const gasto = Number(f.caja); deuda5050Leo += gasto / 2; deuda5050Bruno += gasto / 2; if (f.encargado === "Leo") gastosSalientesLeo += gasto; else gastosSalientesBruno += gasto; } 
      else { const partes = calcularPartes(f); gananciaPuraLeo += partes.limpioLeo; gananciaPuraBruno += partes.limpioBruno; if (f.encargado === "Leo") { cobradoLeo += Number(f.ingreso_total); gastosSalientesLeo += partes.totalAportes; } else { cobradoBruno += Number(f.ingreso_total); gastosSalientesBruno += partes.totalAportes; } }
    });
    return { cobradoLeo, limpioLeoTotal: gananciaPuraLeo, gastosLeo: gastosSalientesLeo, balanceLeo: (cobradoLeo - gastosSalientesLeo) - (gananciaPuraLeo - deuda5050Leo), cobradoBruno, limpioBrunoTotal: gananciaPuraBruno, gastosBruno: gastosSalientesBruno, balanceBruno: (cobradoBruno - gastosSalientesBruno) - (gananciaPuraBruno - deuda5050Bruno) };
  };

  const resumenActual = generarResumen(finanzas);
  const trabajosLeo = trabajosActivos.filter(t => t.encargado === "Leo");
  const trabajosBruno = trabajosActivos.filter(t => t.encargado === "Bruno");

  const trabajosFiltrados = trabajosFinalizados.filter(t => {
    const coincideEncargado = filtroEncargado === "Todos" || t.encargado === filtroEncargado;
    const coincideTexto = t.nombre_expediente.toLowerCase().includes(filtroTexto.toLowerCase());
    return coincideEncargado && coincideTexto;
  });

  const historialAgrupado = historial.reduce((acc, item) => { const key = item.fecha_liquidacion || "anterior"; if (!acc[key]) acc[key] = []; acc[key].push(item); return acc; }, {});
  const fechasOrdenadas = Object.keys(historialAgrupado).sort((a, b) => { if (a === "anterior") return 1; if (b === "anterior") return -1; return new Date(b).getTime() - new Date(a).getTime(); });
  const toggleHistorial = (fechaKey: string) => setSemanasAbiertas({ ...semanasAbiertas, [fechaKey]: !semanasAbiertas[fechaKey] });

  // NUEVAS ETAPAS DE SURVEY ACTUALIZADAS
  const RenderEtapas = ({ t }: { t: any }) => {
    const etapas = [
      { id: 'e_medido', label: 'Medido' }, 
      { id: 'e_definido', label: 'Definido' }, 
      { id: 'e_solicitado_ld', label: 'Solicitado LD' }, 
      { id: 'e_fac', label: 'FAC' }, 
      { id: 'e_metido_saca_scit', label: 'Metido SACA+SCIT' }, 
      { id: 'e_pedido_cc', label: 'Pedido CC' }, 
      { id: 'e_aprobado', label: 'Aprobado' }, 
      { id: 'e_cc_emitido', label: 'CC Emitido' }
    ];
    return (
      <div className="flex gap-2 flex-wrap">
        {etapas.map(e => (
          <button key={e.id} onClick={() => toggleEtapa(t.id, e.id, t[e.id])} title={e.label}
            className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border transition-colors ${t[e.id] ? 'bg-[#727A4E] text-white border-[#727A4E]' : 'bg-[#222222] text-zinc-500 border-zinc-700 hover:border-zinc-500'}`}>
            {e.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#111111] p-8 font-sans text-zinc-300">
      
      <header className="mb-8 bg-[#1A1A1A] p-8 rounded-xl shadow-2xl flex items-center justify-between border-l-4 border-[#727A4E]">
        <div>
          <h1 className="text-4xl font-black tracking-widest uppercase flex items-center gap-3 text-white">SURVEY</h1>
          <p className="text-[#727A4E] tracking-widest text-sm font-bold mt-1">ADMINISTRACIÓN & GESTIÓN</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setActiveTab("trabajos")} className={`px-5 py-2.5 rounded-md font-bold tracking-wider uppercase text-xs transition-all ${activeTab === "trabajos" ? "bg-[#727A4E] text-white shadow-md" : "bg-transparent text-zinc-500 hover:text-white border border-zinc-800 hover:border-[#727A4E]"}`}>Expedientes</button>
          <button onClick={() => setActiveTab("mediciones")} className={`px-5 py-2.5 rounded-md font-bold tracking-wider uppercase text-xs transition-all ${activeTab === "mediciones" ? "bg-[#727A4E] text-white shadow-md" : "bg-transparent text-zinc-500 hover:text-white border border-zinc-800 hover:border-[#727A4E]"}`}>📏 Mediciones</button>
          <button onClick={() => setActiveTab("finanzas")} className={`px-5 py-2.5 rounded-md font-bold tracking-wider uppercase text-xs transition-all ${activeTab === "finanzas" ? "bg-[#727A4E] text-white shadow-md" : "bg-transparent text-zinc-500 hover:text-white border border-zinc-800 hover:border-[#727A4E]"}`}>Finanzas</button>
          <button onClick={() => setActiveTab("historial")} className={`px-5 py-2.5 rounded-md font-bold tracking-wider uppercase text-xs transition-all ${activeTab === "historial" ? "bg-[#727A4E] text-white shadow-md" : "bg-transparent text-zinc-500 hover:text-white border border-zinc-800 hover:border-[#727A4E]"}`}>Historial</button>
          <button onClick={() => setActiveTab("catastro")} className={`px-5 py-2.5 rounded-md font-bold tracking-wider uppercase text-xs transition-all flex items-center gap-2 ml-4 ${activeTab === "catastro" ? "bg-white text-[#1A1A1A] shadow-md" : "bg-[#222222] text-[#727A4E] hover:bg-[#333] border border-[#727A4E]/30"}`}>🔑 SCIT</button>
        </div>
      </header>

      {/* PESTAÑA: TRABAJOS EN CURSO E HISTORIAL */}
      {activeTab === "trabajos" && (
        <div className="space-y-6">
          <div className="flex gap-4 border-b border-zinc-800 pb-4">
            <button onClick={() => setSubTabTrabajos("activos")} className={`font-bold tracking-widest uppercase text-sm px-4 py-2 rounded transition-colors ${subTabTrabajos === "activos" ? "bg-[#727A4E] text-white" : "text-zinc-500 hover:bg-zinc-800"}`}>🟢 En Curso</button>
            <button onClick={() => setSubTabTrabajos("finalizados")} className={`font-bold tracking-widest uppercase text-sm px-4 py-2 rounded transition-colors ${subTabTrabajos === "finalizados" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:bg-zinc-800"}`}>📁 Historial de Finalizados</button>
          </div>

          {subTabTrabajos === "activos" && (
            <>
              <form onSubmit={guardarTrabajo} className="bg-[#1A1A1A] p-6 rounded-xl shadow-lg flex gap-4 items-end border border-zinc-800">
                <div className="flex-1"><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Expediente</label><input required className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevoTrabajo.nombre} onChange={e => setNuevoTrabajo({...nuevoTrabajo, nombre: e.target.value})} placeholder="Ej: PH DELTA"/></div>
                <div className="flex-1"><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Notas / Nro (Opcional)</label><input className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevoTrabajo.estado} onChange={e => setNuevoTrabajo({...nuevoTrabajo, estado: e.target.value})} placeholder="Ej: Esperando firma"/></div>
                <div><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Encargado</label><select className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevoTrabajo.encargado} onChange={e => setNuevoTrabajo({...nuevoTrabajo, encargado: e.target.value})}><option>Leo</option><option>Bruno</option></select></div>
                <div><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Prioridad</label><select className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevoTrabajo.color} onChange={e => setNuevoTrabajo({...nuevoTrabajo, color: e.target.value})}><option value="verde">Normal</option><option value="amarillo">Urgente</option></select></div>
                
                <button type="submit" className={`px-6 py-3 rounded-md font-bold tracking-widest text-white uppercase text-xs transition-colors ${editandoTrabajoId ? 'bg-orange-600 hover:bg-orange-500' : 'bg-[#727A4E] hover:bg-[#8B9461]'}`}>{editandoTrabajoId ? "Guardar" : "Agregar"}</button>
                {editandoTrabajoId && <button type="button" onClick={() => {setEditandoTrabajoId(null); setNuevoTrabajo({ nombre: "", estado: "", color: "verde", encargado: "Leo" });}} className="px-6 py-3 rounded-md font-bold tracking-widest text-zinc-300 bg-zinc-800 hover:bg-zinc-700 uppercase text-xs">Cancelar</button>}
              </form>

              <div className="space-y-6">
                
                {/* EXPEDIENTES LEO - CONTRAÍBLE */}
                <div className="bg-[#1A1A1A] rounded-xl shadow-lg overflow-hidden border border-zinc-800">
                  <div 
                    onClick={() => setLeoAbierto(!leoAbierto)} 
                    className="bg-[#222222] p-4 border-b border-zinc-800 flex justify-between cursor-pointer hover:bg-[#2A2A2A] transition-colors select-none"
                  >
                    <h3 className="font-bold text-white tracking-widest uppercase text-sm flex items-center gap-2">
                      <span className="text-[#727A4E] text-xs">{leoAbierto ? '▼' : '▶'}</span> Expedientes Leo
                    </h3>
                    <span className="text-[#727A4E] font-bold text-sm bg-[#111] px-3 py-1 rounded-full border border-zinc-700">{trabajosLeo.length} Activos</span>
                  </div>
                  
                  {leoAbierto && (
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {trabajosLeo.map(t => (
                          <tr key={t.id} className="border-b border-zinc-800 hover:bg-[#2A2A2A] transition-colors">
                            <td className="p-4 w-1/4">
                              <div className="font-bold text-zinc-200 text-lg flex items-center gap-2">
                                {t.color_alerta === 'amarillo' && <span title="Urgente" className="text-yellow-500 text-sm">⚠️</span>} {t.nombre_expediente}
                              </div>
                              <div className="text-zinc-500 text-xs mt-1">{t.estado_detalle}</div>
                            </td>
                            <td className="p-4 w-2/4"><RenderEtapas t={t} /></td>
                            <td className="p-4 text-right flex gap-3 justify-end items-center h-full pt-6 w-1/4">
                              <button onClick={() => iniciarEdicionTrabajo(t)} className="text-xl opacity-40 hover:opacity-100 transition-all" title="Editar Expediente">✏️</button>
                              <button onClick={() => finalizarTrabajo(t)} className="text-xl opacity-40 hover:opacity-100 transition-all" title="Marcar como Finalizado">✅</button>
                              <button onClick={() => eliminarTrabajo(t.id)} className="text-xl opacity-40 hover:opacity-100 hover:text-red-500 transition-all" title="Eliminar definitivamente">🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* EXPEDIENTES BRUNO - CONTRAÍBLE */}
                <div className="bg-[#1A1A1A] rounded-xl shadow-lg overflow-hidden border border-zinc-800">
                  <div 
                    onClick={() => setBrunoAbierto(!brunoAbierto)} 
                    className="bg-[#222222] p-4 border-b border-zinc-800 flex justify-between cursor-pointer hover:bg-[#2A2A2A] transition-colors select-none"
                  >
                    <h3 className="font-bold text-white tracking-widest uppercase text-sm flex items-center gap-2">
                      <span className="text-[#727A4E] text-xs">{brunoAbierto ? '▼' : '▶'}</span> Expedientes Bruno
                    </h3>
                    <span className="text-[#727A4E] font-bold text-sm bg-[#111] px-3 py-1 rounded-full border border-zinc-700">{trabajosBruno.length} Activos</span>
                  </div>
                  
                  {brunoAbierto && (
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {trabajosBruno.map(t => (
                          <tr key={t.id} className="border-b border-zinc-800 hover:bg-[#2A2A2A] transition-colors">
                            <td className="p-4 w-1/4">
                              <div className="font-bold text-zinc-200 text-lg flex items-center gap-2">
                                {t.color_alerta === 'amarillo' && <span title="Urgente" className="text-yellow-500 text-sm">⚠️</span>} {t.nombre_expediente}
                              </div>
                              <div className="text-zinc-500 text-xs mt-1">{t.estado_detalle}</div>
                            </td>
                            <td className="p-4 w-2/4"><RenderEtapas t={t} /></td>
                            <td className="p-4 text-right flex gap-3 justify-end items-center h-full pt-6 w-1/4">
                              <button onClick={() => iniciarEdicionTrabajo(t)} className="text-xl opacity-40 hover:opacity-100 transition-all" title="Editar Expediente">✏️</button>
                              <button onClick={() => finalizarTrabajo(t)} className="text-xl opacity-40 hover:opacity-100 transition-all" title="Marcar como Finalizado">✅</button>
                              <button onClick={() => eliminarTrabajo(t.id)} className="text-xl opacity-40 hover:opacity-100 hover:text-red-500 transition-all" title="Eliminar definitivamente">🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

              </div>
            </>
          )}

          {subTabTrabajos === "finalizados" && (
            <div className="bg-[#1A1A1A] rounded-xl shadow-lg overflow-hidden border border-zinc-800">
              <div className="bg-[#222222] p-6 border-b border-zinc-800 flex justify-between items-end gap-4">
                <div>
                  <h3 className="font-bold text-white tracking-widest uppercase text-sm mb-4">Historial Histórico</h3>
                  <div className="flex gap-4">
                    <div>
                      <label className="text-xs uppercase tracking-wider font-bold text-zinc-500 block mb-1">Buscar Expediente</label>
                      <input type="text" placeholder="Ej: Loteo San José..." value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)}
                        className="border-b-2 border-zinc-700 bg-[#1A1A1A] text-white p-2 rounded focus:outline-none focus:border-[#727A4E] text-sm w-64"/>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider font-bold text-zinc-500 block mb-1">Filtrar por Encargado</label>
                      <select value={filtroEncargado} onChange={e => setFiltroEncargado(e.target.value)}
                        className="border-b-2 border-zinc-700 bg-[#1A1A1A] text-white p-2 rounded focus:outline-none focus:border-[#727A4E] text-sm w-40">
                        <option value="Todos">Todos</option>
                        <option value="Leo">Leo</option>
                        <option value="Bruno">Bruno</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="bg-[#727A4E]/20 text-[#A4B070] px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border border-[#727A4E]/30">{trabajosFiltrados.length} Terminados</span>
                </div>
              </div>

              {trabajosFiltrados.length === 0 ? (
                <p className="p-8 text-center text-zinc-500 font-bold tracking-widest uppercase">No se encontraron expedientes</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead><tr className="bg-[#111111] text-[#727A4E] font-bold uppercase text-xs tracking-wider border-b border-zinc-800"><th className="p-4">Expediente</th><th className="p-4">Encomienda</th><th className="p-4">Fecha Finalización</th><th className="p-4 w-16">Acción</th></tr></thead>
                  <tbody>
                    {trabajosFiltrados.map(t => (
                      <tr key={t.id} className="border-b border-zinc-800 hover:bg-[#2A2A2A]">
                        <td className="p-4">
                            <span className="font-bold text-zinc-300 block">{t.nombre_expediente}</span>
                        </td>
                        <td className="p-4 text-zinc-400 font-bold">{t.encargado}</td>
                        <td className="p-4 text-zinc-400">{t.fecha_finalizacion ? new Date(t.fecha_finalizacion).toLocaleDateString("es-AR", { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}</td>
                        <td className="p-4 text-center"><button onClick={() => eliminarTrabajo(t.id)} title="Eliminar definitivamente" className="text-lg opacity-30 hover:opacity-100 hover:text-red-500 transition-all">🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA: MEDICIONES */}
      {activeTab === "mediciones" && (
        <div className="space-y-8">
           <form onSubmit={guardarMedicion} className="bg-[#1A1A1A] p-6 rounded-xl shadow-lg flex gap-4 items-end border border-zinc-800">
            <div className="flex-1"><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Expediente / Propietario</label><input required className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaMedicion.titulo} onChange={e => setNuevaMedicion({...nuevaMedicion, titulo: e.target.value})} placeholder="Ej: PH DELTA"/></div>
            <div><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Fecha</label><input type="date" required className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E] cursor-pointer" value={nuevaMedicion.fecha} onChange={e => setNuevaMedicion({...nuevaMedicion, fecha: e.target.value})} onClick={(e: any) => e.target.showPicker && e.target.showPicker()}/></div>
            <div><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Hora</label><select required className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E] cursor-pointer" value={nuevaMedicion.hora} onChange={e => setNuevaMedicion({...nuevaMedicion, hora: e.target.value})}>{Array.from({ length: 28 }).map((_, i) => { const h = Math.floor(i / 2) + 7; const m = i % 2 === 0 ? "00" : "30"; const hStr = `${h.toString().padStart(2, '0')}:${m}`; return <option key={hStr} value={hStr}>{hStr} hs</option>; })}</select></div>
            <div className="flex-1"><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Ubicación (Opcional)</label><input className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaMedicion.ubicacion} onChange={e => setNuevaMedicion({...nuevaMedicion, ubicacion: e.target.value})} placeholder="Ej: San Martin 2314"/></div>
            <button type="submit" className="px-6 py-3 rounded-md font-bold tracking-widest text-white uppercase text-xs transition-colors bg-[#727A4E] hover:bg-[#8B9461]">AGENDAR</button>
          </form>

          <div className="bg-[#1A1A1A] rounded-xl shadow-lg overflow-hidden border border-zinc-800">
            <div className="bg-[#222222] p-4 border-b border-zinc-800"><h3 className="font-bold text-white tracking-widest uppercase text-sm">Próximas Mediciones</h3></div>
            {mediciones.length === 0 ? ( <p className="p-8 text-center text-zinc-500 font-bold tracking-widest uppercase">No hay mediciones pendientes</p> ) : (
              <table className="w-full text-left border-collapse">
                <thead><tr className="bg-[#111111] text-[#727A4E] font-bold uppercase text-xs tracking-wider border-b border-zinc-800"><th className="p-4">Expediente</th><th className="p-4">Fecha</th><th className="p-4">Hora</th><th className="p-4">Ubicación</th><th className="p-4">Acciones</th></tr></thead>
                <tbody>
                  {mediciones.map(m => {
                    const [anio, mes, dia] = m.fecha.split("-");
                    return (
                      <tr key={m.id} className="border-b border-zinc-800 hover:bg-[#2A2A2A]">
                        <td className="p-4 font-bold text-zinc-200">{m.titulo}</td><td className="p-4 text-white font-bold">{`${dia}/${mes}/${anio}`}</td><td className="p-4 text-zinc-300">{m.hora} hs</td><td className="p-4 text-zinc-400">{m.ubicacion || "-"}</td>
                        <td className="p-4 flex gap-3 items-center">
                          <a href={generarLinkCalendar(m)} target="_blank" rel="noreferrer" className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-800/50 px-3 py-1.5 rounded text-xs tracking-wider font-bold uppercase">📅 Calendar</a>
                          <button onClick={() => completarMedicion(m.id)} className="bg-[#727A4E]/20 hover:bg-[#727A4E]/40 text-[#A4B070] border border-[#727A4E]/50 px-3 py-1.5 rounded text-xs tracking-wider font-bold uppercase">✅ Listo</button>
                          <button onClick={() => borrarMedicion(m.id)} className="text-lg opacity-40 hover:opacity-100 hover:text-red-500">🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA: CATASTRO */}
      {activeTab === "catastro" && (
        <div className="flex flex-col items-center justify-center pt-10">
          <div className={`p-12 rounded-3xl shadow-2xl w-full max-w-2xl text-center border-4 ${catastro.usuario === 'Libre' ? 'bg-green-100 border-green-500' : 'bg-red-100 border-red-500'}`}>
            <h2 className="text-2xl font-bold text-zinc-800 mb-2 uppercase tracking-widest">Estado del Sistema Catastro</h2>
            <div className={`text-6xl font-black mb-6 uppercase tracking-wider ${catastro.usuario === 'Libre' ? 'text-green-700' : 'text-red-700'}`}>
              {catastro.usuario === 'Libre' ? '✅ LIBRE' : `🚫 EN USO POR ${catastro.usuario}`}
            </div>
            {catastro.usuario !== "Libre" && (
              <div className="text-xl font-bold text-zinc-800 mb-8 bg-white/70 py-3 px-6 rounded-xl inline-block shadow-sm">⏱️ Tiempo en uso: <span className="text-red-600">{tiempoUso}</span></div>
            )}
            <div className="flex gap-4 justify-center mt-4">
              {catastro.usuario === "Libre" ? (
                <>
                  <button onClick={() => tomarCatastro("Leo")} className="bg-[#1A1A1A] hover:bg-[#333] text-white text-xl font-bold px-8 py-4 rounded-xl shadow-lg uppercase tracking-widest">🙋‍♂️ Usar (Leo)</button>
                  <button onClick={() => tomarCatastro("Bruno")} className="bg-[#727A4E] hover:bg-[#5E653F] text-white text-xl font-bold px-8 py-4 rounded-xl shadow-lg uppercase tracking-widest">🙋‍♂️ Usar (Bruno)</button>
                </>
              ) : ( <button onClick={liberarCatastro} className="bg-green-600 hover:bg-green-700 text-white text-2xl font-black px-12 py-5 rounded-xl shadow-lg w-full uppercase tracking-widest">🔓 LIBERAR SISTEMA</button> )}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: FINANZAS */}
      {activeTab === "finanzas" && (
        <div className="space-y-6">
          <div className="bg-[#1A1A1A] p-6 rounded-xl shadow-lg border border-zinc-800">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
              <h2 className="font-black tracking-widest text-white uppercase">{nuevaFinanza.esGasto5050 ? "💼 CARGAR GASTO COMPARTIDO (50/50)" : "📝 CARGAR EXPEDIENTE NORMAL"}</h2>
              <button onClick={toggleGasto5050} type="button" className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded border transition-colors ${nuevaFinanza.esGasto5050 ? 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700' : 'bg-transparent text-[#727A4E] border-[#727A4E] hover:bg-[#727A4E]/10'}`}>
                {nuevaFinanza.esGasto5050 ? "Volver a Expedientes" : "Cargar Gasto Compartido"}
              </button>
            </div>

            <form onSubmit={guardarFinanza} className="grid grid-cols-4 gap-4 items-end">
              {!nuevaFinanza.esGasto5050 ? (
                <>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Tipo</label><input ref={tipoInputRef} required className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.tramite} onChange={e => actualizarValoresFinanza('tramite', e.target.value)}/></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Propietario</label><input required className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.propietario} onChange={e => setNuevaFinanza({...nuevaFinanza, propietario: e.target.value})}/></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Entró por</label><select className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.encargado} onChange={e => actualizarValoresFinanza('encargado', e.target.value)}><option value="Leo">Leo</option><option value="Bruno">Bruno</option></select></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-[#A4B070]">Ingreso Total ($)</label><input type="text" inputMode="numeric" required className="w-full border-b-2 border-[#727A4E] bg-[#222222] p-3 rounded font-black text-[#A4B070] focus:outline-none focus:border-[#8B9461]" value={nuevaFinanza.ingreso === 0 ? "" : formatearPlata(nuevaFinanza.ingreso)} onChange={e => handlePlataInput('ingreso', e.target.value)} placeholder="0"/></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Caja ($)</label><input type="text" inputMode="numeric" className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.caja === 0 ? "" : formatearPlata(nuevaFinanza.caja)} onChange={e => handlePlataInput('caja', e.target.value)} placeholder="0"/></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Colegio ($)</label><input type="text" inputMode="numeric" className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.colegio === 0 ? "" : formatearPlata(nuevaFinanza.colegio)} onChange={e => handlePlataInput('colegio', e.target.value)} placeholder="0"/></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Extra Leo ($)</label><input type="text" inputMode="numeric" className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.extraLeo === 0 ? "" : formatearPlata(nuevaFinanza.extraLeo)} onChange={e => handlePlataInput('extraLeo', e.target.value)} placeholder="0"/></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Extra Bruno ($)</label><input type="text" inputMode="numeric" className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.extraBruno === 0 ? "" : formatearPlata(nuevaFinanza.extraBruno)} onChange={e => handlePlataInput('extraBruno', e.target.value)} placeholder="0"/></div>
                </>
              ) : (
                <>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Concepto</label><input ref={tipoInputRef} required className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.tramite} onChange={e => setNuevaFinanza({...nuevaFinanza, tramite: e.target.value})}/></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Pagado por</label><select className="w-full border-b-2 border-zinc-700 bg-[#222222] text-white p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.encargado} onChange={e => setNuevaFinanza({...nuevaFinanza, encargado: e.target.value})}><option value="Leo">Leo</option><option value="Bruno">Bruno</option></select></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-red-500">Monto del Gasto ($)</label><input type="text" inputMode="numeric" required className="w-full border-b-2 border-red-900 bg-[#222222] p-3 rounded font-black text-red-400 focus:outline-none focus:border-red-500" value={nuevaFinanza.caja === 0 ? "" : formatearPlata(nuevaFinanza.caja)} onChange={e => handlePlataInput('caja', e.target.value)} placeholder="0"/></div>
                  <div className="text-xs tracking-wide text-zinc-500 pb-3">Se descontará 50% a cada uno automáticamente.</div>
                </>
              )}
              <div className="col-span-4 flex justify-end gap-3 mt-4">
                {editandoFinanzaId && (<button type="button" onClick={() => {setEditandoFinanzaId(null); setNuevaFinanza({ tramite: "VEP", propietario: "", encargado: "Leo", ingreso: 0, caja: 83000, colegio: 69300, extraLeo: 20800, extraBruno: 0, esGasto5050: false });}} className="px-6 py-3 rounded text-xs tracking-widest font-bold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 uppercase">Cancelar</button>)}
                <button type="submit" className={`px-8 py-3 rounded text-white text-xs font-black tracking-widest uppercase shadow-md transition-colors ${editandoFinanzaId ? 'bg-orange-600 hover:bg-orange-500' : 'bg-[#727A4E] hover:bg-[#8B9461]'}`}>{editandoFinanzaId ? "GUARDAR" : "CARGAR"}</button>
              </div>
            </form>
          </div>

          <div className="bg-[#222222] border border-[#727A4E]/30 rounded-xl shadow-2xl p-8 flex items-center justify-between relative overflow-hidden">
            <div className="flex gap-16 relative z-10">
              <div>
                <h4 className="text-[#727A4E] font-black tracking-widest text-sm mb-3">RESUMEN LEO</h4>
                <p className="text-sm mb-1 text-zinc-400">Cobrado: <span className="text-white font-medium">${formatearPlata(resumenActual.cobradoLeo)}</span></p>
                <p className="text-sm mb-1 text-zinc-400">Limpio Exp.: <span className="text-white font-medium">${formatearPlata(resumenActual.limpioLeoTotal)}</span></p>
                <p className="text-sm border-b border-zinc-700 pb-2 mb-2 text-zinc-400">Pagado Gral: <span className="text-white font-medium">${formatearPlata(resumenActual.gastosLeo)}</span></p>
                <p className={`font-black text-xl tracking-wide ${resumenActual.balanceLeo > 0 ? 'text-red-400' : 'text-[#A4B070]'}`}>
                  {resumenActual.balanceLeo > 0 ? `Transferir: $${formatearPlata(resumenActual.balanceLeo)}` : `A favor: $${formatearPlata(Math.abs(resumenActual.balanceLeo))}`}
                </p>
              </div>
              <div>
                <h4 className="text-[#727A4E] font-black tracking-widest text-sm mb-3">RESUMEN BRUNO</h4>
                <p className="text-sm mb-1 text-zinc-400">Cobrado: <span className="text-white font-medium">${formatearPlata(resumenActual.cobradoBruno)}</span></p>
                <p className="text-sm mb-1 text-zinc-400">Limpio Exp.: <span className="text-white font-medium">${formatearPlata(resumenActual.limpioBrunoTotal)}</span></p>
                <p className="text-sm border-b border-zinc-700 pb-2 mb-2 text-zinc-400">Pagado Gral: <span className="text-white font-medium">${formatearPlata(resumenActual.gastosBruno)}</span></p>
                <p className={`font-black text-xl tracking-wide ${resumenActual.balanceBruno > 0 ? 'text-red-400' : 'text-[#A4B070]'}`}>
                  {resumenActual.balanceBruno > 0 ? `Transferir: $${formatearPlata(resumenActual.balanceBruno)}` : `A favor: $${formatearPlata(Math.abs(resumenActual.balanceBruno))}`}
                </p>
              </div>
            </div>
            <button onClick={liquidarSemana} className="bg-[#727A4E] text-white hover:bg-[#8B9461] px-8 py-4 rounded font-black text-sm uppercase tracking-widest shadow-lg relative z-10 border border-[#8B9461]">CERRAR SEMANA</button>
          </div>

          <div className="bg-[#1A1A1A] rounded-xl shadow-lg overflow-x-auto border border-zinc-800">
            <table className="w-full text-left whitespace-nowrap">
              <thead><tr className="bg-[#222222] text-[#727A4E] font-bold uppercase text-xs tracking-wider border-b border-zinc-800"><th className="p-4">Tipo</th><th className="p-4">Propietario / Pagó</th><th className="p-4">Ingreso / Costo</th><th className="p-4">Gastos Trámite</th><th className="p-4 text-zinc-300">Limpio Leo</th><th className="p-4 text-zinc-300">Limpio Bruno</th><th className="p-4 w-16">Acción</th></tr></thead>
              <tbody>
                {finanzas.map((f) => {
                  const partes = calcularPartes(f);
                  return (
                    <tr key={f.id} className={`border-b border-zinc-800 hover:bg-[#2A2A2A] ${f.es_gasto_5050 ? 'bg-[#1E1E1E]' : ''}`}>
                      <td className="p-4 font-bold text-zinc-200">{f.tipo_tramite} {f.es_gasto_5050 && <span className="ml-2 text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded uppercase tracking-wider">50/50</span>}</td>
                      <td className="p-4 text-zinc-400">{f.es_gasto_5050 ? <span className="font-bold text-zinc-300">Pagó {f.encargado}</span> : f.propietario}</td>
                      <td className={`p-4 font-black ${f.es_gasto_5050 ? 'text-red-400' : 'text-[#A4B070]'}`}>${formatearPlata(f.es_gasto_5050 ? f.caja : f.ingreso_total)}</td>
                      <td className="p-4 text-zinc-500">{f.es_gasto_5050 ? '-' : `$${formatearPlata(partes.totalAportes)}`}</td>
                      <td className={`p-4 font-bold ${partes.limpioLeo < 0 ? 'text-red-500' : 'text-zinc-200'}`}>${f.es_gasto_5050 ? '$0' : formatearPlata(partes.limpioLeo)}</td>
                      <td className={`p-4 font-bold ${partes.limpioBruno < 0 ? 'text-red-500' : 'text-zinc-200'}`}>${f.es_gasto_5050 ? '$0' : formatearPlata(partes.limpioBruno)}</td>
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
      )}

      {/* PESTAÑA: HISTORIAL FINANZAS */}
      {activeTab === "historial" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-black tracking-widest text-white mb-6 uppercase border-b border-zinc-800 pb-4">Finanzas Liquidadas</h2>
          {fechasOrdenadas.map(fechaKey => {
            const trabajosDelBloque = historialAgrupado[fechaKey];
            const tituloBloque = fechaKey === "anterior" ? "Liquidaciones Anteriores (Sin fecha)" : `Liquidación ${new Date(fechaKey).toLocaleDateString("es-AR")}`;
            const estaAbierto = semanasAbiertas[fechaKey] || false;
            const resumenBloque = generarResumen(trabajosDelBloque);

            return (
              <div key={fechaKey} className="bg-[#1A1A1A] rounded-xl shadow-lg overflow-hidden border border-zinc-800">
                <div className="bg-[#222222] p-5 border-b-2 border-zinc-800 flex justify-between items-center text-white">
                  <h3 onClick={() => toggleHistorial(fechaKey)} className="font-bold text-lg cursor-pointer flex-1 tracking-widest uppercase flex items-center gap-3 hover:text-[#727A4E]">
                    {tituloBloque} <span className="text-zinc-400 text-xs font-bold px-2 py-1 bg-[#1A1A1A] rounded border border-zinc-700">({trabajosDelBloque.length}) {estaAbierto ? '▼' : '▶'}</span>
                  </h3>
                  <div className="flex gap-3">
                    <button onClick={() => reabrirSemana(fechaKey)} className="bg-transparent border border-zinc-600 hover:border-zinc-400 text-zinc-300 hover:text-white px-4 py-1.5 text-xs tracking-wider font-bold rounded uppercase">Reabrir</button>
                    <button onClick={() => eliminarSemana(fechaKey)} className="bg-red-900/20 hover:bg-red-900/60 border border-red-900/50 text-red-400 px-4 py-1.5 text-xs tracking-wider font-bold rounded uppercase">Borrar</button>
                  </div>
                </div>
                
                {estaAbierto && (
                  <div>
                    <div className="bg-[#1A1A1A] p-6 border-b border-zinc-800 flex justify-around">
                      <div className="text-center">
                        <span className="text-xs font-black tracking-widest text-[#727A4E] block mb-1">BALANCE LEO (CERRADO)</span>
                        <span className={`font-black text-xl tracking-wide ${resumenBloque.balanceLeo > 0 ? 'text-red-400' : 'text-zinc-200'}`}>{resumenBloque.balanceLeo > 0 ? `Transfirió: $${formatearPlata(resumenBloque.balanceLeo)}` : `Recibió: $${formatearPlata(Math.abs(resumenBloque.balanceLeo))}`}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-black tracking-widest text-[#727A4E] block mb-1">BALANCE BRUNO (CERRADO)</span>
                        <span className={`font-black text-xl tracking-wide ${resumenBloque.balanceBruno > 0 ? 'text-red-400' : 'text-zinc-200'}`}>{resumenBloque.balanceBruno > 0 ? `Transfirió: $${formatearPlata(resumenBloque.balanceBruno)}` : `Recibió: $${formatearPlata(Math.abs(resumenBloque.balanceBruno))}`}</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left whitespace-nowrap">
                        <thead><tr className="bg-[#222222] text-zinc-400 uppercase text-xs tracking-wider border-b border-zinc-800"><th className="p-4">Tipo</th><th className="p-4">Propietario</th><th className="p-4">Entró Por</th><th className="p-4">Total/Gasto</th><th className="p-4">Limpio Leo</th><th className="p-4">Limpio Bruno</th></tr></thead>
                        <tbody>
                          {trabajosDelBloque.map((h: any) => {
                            const partes = calcularPartes(h);
                            return (
                              <tr key={h.id} className={`border-b border-zinc-800 ${h.es_gasto_5050 ? 'bg-[#1E1E1E]' : ''}`}>
                                <td className="p-4 font-bold text-zinc-300">{h.tipo_tramite} {h.es_gasto_5050 && <span className="ml-2 text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded">50/50</span>}</td>
                                <td className="p-4 text-zinc-400">{h.es_gasto_5050 ? `Pagó ${h.encargado}` : h.propietario}</td>
                                <td className="p-4 text-zinc-500">{h.es_gasto_5050 ? '-' : h.encargado}</td>
                                <td className={`p-4 font-bold ${h.es_gasto_5050 ? 'text-red-400' : 'text-zinc-300'}`}>${formatearPlata(h.es_gasto_5050 ? h.caja : h.ingreso_total)}</td>
                                <td className="p-4 text-zinc-400">${h.es_gasto_5050 ? '$0' : formatearPlata(partes.limpioLeo)}</td>
                                <td className="p-4 text-zinc-400">${h.es_gasto_5050 ? '$0' : formatearPlata(partes.limpioBruno)}</td>
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
}
