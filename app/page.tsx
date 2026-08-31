"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const telegramBotToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || "";
const telegramChatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || "";

export default function DashboardAgrimensura() {
  const [activeTab, setActiveTab] = useState("finanzas");
  const [trabajos, setTrabajos] = useState<any[]>([]);
  const [finanzas, setFinanzas] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  
  const [catastro, setCatastro] = useState({ usuario: "Libre", fecha: "" });
  const [tiempoUso, setTiempoUso] = useState("");
  const [semanasAbiertas, setSemanasAbiertas] = useState<Record<string, boolean>>({});
  const tipoInputRef = useRef<HTMLInputElement>(null);

  const [nuevoTrabajo, setNuevoTrabajo] = useState({ nombre: "", estado: "", color: "verde", encargado: "Leo" });
  const [editandoTrabajoId, setEditandoTrabajoId] = useState<string | null>(null);
  const [editandoFinanzaId, setEditandoFinanzaId] = useState<string | null>(null);
  const [nuevaFinanza, setNuevaFinanza] = useState({ 
    tramite: "VEP", propietario: "", encargado: "Leo", ingreso: 0, caja: 83000, colegio: 69300, extraLeo: 20800, extraBruno: 0, esGasto5050: false
  });

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
    const { data: dataTrabajos } = await supabase.from("trabajos_curso").select("*").order("fecha_actualizacion", { ascending: false });
    const { data: dataFinanzas } = await supabase.from("finanzas").select("*").eq("liquidado", false).order("fecha_carga", { ascending: false });
    const { data: dataHistorial } = await supabase.from("finanzas").select("*").eq("liquidado", true).order("fecha_liquidacion", { ascending: false });
    const { data: dataCatastro } = await supabase.from("estado_catastro").select("*").limit(1);
    
    if (dataTrabajos) setTrabajos(dataTrabajos);
    if (dataFinanzas) setFinanzas(dataFinanzas);
    if (dataHistorial) setHistorial(dataHistorial);
    if (dataCatastro && dataCatastro.length > 0) setCatastro({ usuario: dataCatastro[0].usuario, fecha: dataCatastro[0].fecha_actualizacion });
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

  const handlePlataInput = (campo: string, valorStr: string) => {
    const valorLimpio = valorStr.replace(/\D/g, ''); 
    setNuevaFinanza({ ...nuevaFinanza, [campo]: Number(valorLimpio) });
  };

  const actualizarValoresFinanza = (campo: string, valor: string) => {
    let nuevoTramite = campo === 'tramite' ? valor : nuevaFinanza.tramite;
    let nuevoEncargado = campo === 'encargado' ? valor : nuevaFinanza.encargado;
    let eLeo = 0, eBruno = 0;
    const esREP = nuevoTramite.toUpperCase().includes("REP");
    if (nuevoEncargado === "Leo") { eLeo = 20800; eBruno = esREP ? 11700 : 0; } 
    else { eLeo = 0; eBruno = esREP ? (20800 + 11700) : 20800; }
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
  };

  const guardarFinanza = async (e: any) => {
    e.preventDefault();
    const datosGuardar = { tipo_tramite: nuevaFinanza.tramite, propietario: nuevaFinanza.propietario, encargado: nuevaFinanza.encargado, ingreso_total: nuevaFinanza.ingreso, caja: nuevaFinanza.caja, colegio: nuevaFinanza.colegio, extra_leo: nuevaFinanza.extraLeo, extra_bruno: nuevaFinanza.extraBruno, es_gasto_5050: nuevaFinanza.esGasto5050 };
    if (editandoFinanzaId) {
      await supabase.from("finanzas").update(datosGuardar).eq("id", editandoFinanzaId);
      setEditandoFinanzaId(null);
    } else await supabase.from("finanzas").insert([datosGuardar]);
    setNuevaFinanza({ tramite: "VEP", propietario: "", encargado: "Leo", ingreso: 0, caja: 83000, colegio: 69300, extraLeo: 20800, extraBruno: 0, esGasto5050: false });
    cargarDatos();
    setTimeout(() => { tipoInputRef.current?.focus(); }, 100);
  };

  const iniciarEdicionFinanza = (f: any) => {
    setEditandoFinanzaId(f.id);
    setNuevaFinanza({ tramite: f.tipo_tramite, propietario: f.propietario, encargado: f.encargado, ingreso: Number(f.ingreso_total), caja: Number(f.caja), colegio: Number(f.colegio), extraLeo: Number(f.extra_leo || 0), extraBruno: Number(f.extra_bruno || 0), esGasto5050: f.es_gasto_5050 || false });
  };

  const eliminarFinanza = async (id: string) => {
    if (confirm("¿Estás seguro de borrar este registro?")) { await supabase.from("finanzas").delete().eq("id", id); cargarDatos(); }
  };

  const liquidarSemana = async () => {
    if (finanzas.length === 0) return alert("No hay trabajos pendientes para liquidar.");
    if (confirm("¿Estás seguro de liquidar? Se cerrarán las cuentas y los trabajos pasarán al historial.")) {
      const ids = finanzas.map(f => f.id);
      await supabase.from("finanzas").update({ liquidado: true, fecha_liquidacion: new Date().toISOString() }).in("id", ids);
      cargarDatos();
      alert("¡Semana liquidada con éxito!");
    }
  };

  const reabrirSemana = async (fechaKey: string) => {
    if (finanzas.length > 0) return alert("⚠️ Tenés una semana en curso actualmente. Liquidá o borrá la actual primero.");
    if (confirm("¿Querés reabrir esta semana? Pasará a 'Semana Actual' para editarse.")) {
      if (fechaKey === "anterior") await supabase.from("finanzas").update({ liquidado: false }).is("fecha_liquidacion", null).eq("liquidado", true);
      else await supabase.from("finanzas").update({ liquidado: false, fecha_liquidacion: null }).eq("fecha_liquidacion", fechaKey);
      await cargarDatos();
      setActiveTab("finanzas");
    }
  };

  const eliminarSemana = async (fechaKey: string) => {
    if (confirm("🚨 ATENCIÓN: ¿Estás seguro de borrar COMPLETAMENTE esta semana del historial?")) {
      if (fechaKey === "anterior") await supabase.from("finanzas").delete().is("fecha_liquidacion", null).eq("liquidado", true);
      else await supabase.from("finanzas").delete().eq("fecha_liquidacion", fechaKey);
      cargarDatos();
    }
  };

  const calcularPartes = (f: any) => {
    if (f.es_gasto_5050) return { totalAportes: Number(f.caja), limpioLeo: 0, limpioBruno: 0 };
    const totalAportes = Number(f.caja) + Number(f.colegio) + Number(f.extra_leo || 0) + Number(f.extra_bruno || 0);
    const limpio = Number(f.ingreso_total) - totalAportes;
    return { totalAportes: Math.round(totalAportes), limpioLeo: Math.round(f.encargado === "Leo" ? limpio * 0.70 : limpio * 0.20), limpioBruno: Math.round(f.encargado === "Bruno" ? limpio * 0.80 : limpio * 0.30) };
  };

  const generarResumen = (lista: any[]) => {
    let cobradoLeo = 0, cobradoBruno = 0, gastosSalientesLeo = 0, gastosSalientesBruno = 0, gananciaPuraLeo = 0, gananciaPuraBruno = 0, deuda5050Leo = 0, deuda5050Bruno = 0;
    lista.forEach(f => {
      if (f.es_gasto_5050) {
        const gasto = Number(f.caja);
        deuda5050Leo += gasto / 2; deuda5050Bruno += gasto / 2;
        if (f.encargado === "Leo") gastosSalientesLeo += gasto; else gastosSalientesBruno += gasto;
      } else {
        const partes = calcularPartes(f);
        gananciaPuraLeo += partes.limpioLeo; gananciaPuraBruno += partes.limpioBruno;
        if (f.encargado === "Leo") { cobradoLeo += Number(f.ingreso_total); gastosSalientesLeo += partes.totalAportes; } 
        else { cobradoBruno += Number(f.ingreso_total); gastosSalientesBruno += partes.totalAportes; }
      }
    });
    const cajaFisicaLeo = cobradoLeo - gastosSalientesLeo; const cajaFisicaBruno = cobradoBruno - gastosSalientesBruno;
    const mereceLeo = gananciaPuraLeo - deuda5050Leo; const mereceBruno = gananciaPuraBruno - deuda5050Bruno;
    return { cobradoLeo, limpioLeoTotal: gananciaPuraLeo, gastosLeo: gastosSalientesLeo, balanceLeo: cajaFisicaLeo - mereceLeo, cobradoBruno, limpioBrunoTotal: gananciaPuraBruno, gastosBruno: gastosSalientesBruno, balanceBruno: cajaFisicaBruno - mereceBruno };
  };

  const resumenActual = generarResumen(finanzas);
  const trabajosLeo = trabajos.filter(t => t.encargado === "Leo");
  const trabajosBruno = trabajos.filter(t => t.encargado === "Bruno");

  const historialAgrupado = historial.reduce((acc, item) => {
    const key = item.fecha_liquidacion || "anterior";
    if (!acc[key]) acc[key] = []; acc[key].push(item); return acc;
  }, {});
  const fechasOrdenadas = Object.keys(historialAgrupado).sort((a, b) => {
    if (a === "anterior") return 1; if (b === "anterior") return -1;
    return new Date(b).getTime() - new Date(a).getTime();
  });
  const toggleHistorial = (fechaKey: string) => setSemanasAbiertas({ ...semanasAbiertas, [fechaKey]: !semanasAbiertas[fechaKey] });

  return (
    <div className="min-h-screen bg-zinc-100 p-8 font-sans text-zinc-900">
      
      {/* HEADER ESTILO SURVEY */}
      <header className="mb-8 bg-[#1A1A1A] p-8 rounded-2xl shadow-xl flex items-center justify-between border-b-4 border-[#727A4E]">
        <div>
          <h1 className="text-4xl font-black tracking-widest uppercase flex items-center gap-3 text-white">
            SURVEY
          </h1>
          <p className="text-[#727A4E] tracking-widest text-sm font-bold mt-1">ADMINISTRACIÓN & GESTIÓN</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setActiveTab("trabajos")} className={`px-5 py-2.5 rounded-md font-bold transition-all ${activeTab === "trabajos" ? "bg-[#727A4E] text-white shadow-md" : "bg-[#27272A] text-zinc-400 hover:text-white"}`}>Expedientes en Curso</button>
          <button onClick={() => setActiveTab("finanzas")} className={`px-5 py-2.5 rounded-md font-bold transition-all ${activeTab === "finanzas" ? "bg-[#727A4E] text-white shadow-md" : "bg-[#27272A] text-zinc-400 hover:text-white"}`}>Finanzas</button>
          <button onClick={() => setActiveTab("historial")} className={`px-5 py-2.5 rounded-md font-bold transition-all ${activeTab === "historial" ? "bg-[#727A4E] text-white shadow-md" : "bg-[#27272A] text-zinc-400 hover:text-white"}`}>Historial</button>
          <button onClick={() => setActiveTab("catastro")} className={`px-5 py-2.5 rounded-md font-bold transition-all flex items-center gap-2 ml-4 ${activeTab === "catastro" ? "bg-white text-[#1A1A1A] shadow-md" : "bg-[#727A4E]/20 text-[#727A4E] hover:bg-[#727A4E]/40"}`}>🔑 SCIT</button>
        </div>
      </header>

      {/* PESTAÑA: CATASTRO */}
      {activeTab === "catastro" && (
        <div className="flex flex-col items-center justify-center pt-10">
          <div className={`p-12 rounded-3xl shadow-xl w-full max-w-2xl text-center border-t-8 bg-white ${catastro.usuario === 'Libre' ? 'border-[#727A4E]' : 'border-red-600'}`}>
            <h2 className="text-2xl font-bold text-zinc-500 mb-2">Estado del Sistema Catastro</h2>
            <div className={`text-6xl font-black mb-6 uppercase tracking-wider ${catastro.usuario === 'Libre' ? 'text-[#727A4E]' : 'text-red-600'}`}>
              {catastro.usuario === 'Libre' ? '✅ LIBRE' : `🚫 EN USO POR ${catastro.usuario}`}
            </div>
            {catastro.usuario !== "Libre" && (
              <div className="text-xl font-bold text-zinc-600 mb-8 bg-zinc-100 py-3 px-6 rounded-xl inline-block">
                ⏱️ Tiempo en uso: <span className="text-red-600">{tiempoUso}</span>
              </div>
            )}
            <div className="flex gap-4 justify-center mt-4">
              {catastro.usuario === "Libre" ? (
                <>
                  <button onClick={() => tomarCatastro("Leo")} className="bg-[#1A1A1A] hover:bg-[#333] text-white text-xl font-bold px-8 py-4 rounded-xl shadow-lg transition-transform hover:scale-105">🙋‍♂️ Usar (Leo)</button>
                  <button onClick={() => tomarCatastro("Bruno")} className="bg-[#727A4E] hover:bg-[#5E653F] text-white text-xl font-bold px-8 py-4 rounded-xl shadow-lg transition-transform hover:scale-105">🙋‍♂️ Usar (Bruno)</button>
                </>
              ) : (
                <button onClick={liberarCatastro} className="bg-[#1A1A1A] hover:bg-[#333] text-white text-2xl font-black px-12 py-5 rounded-xl shadow-lg transition-transform hover:scale-105 w-full">🔓 LIBERAR SISTEMA</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: TRABAJOS EN CURSO */}
      {activeTab === "trabajos" && (
        <div className="space-y-8">
           <form onSubmit={guardarTrabajo} className="bg-white p-6 rounded-xl shadow-md flex gap-4 items-end border border-zinc-200">
            <div className="flex-1"><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Expediente</label><input required className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevoTrabajo.nombre} onChange={e => setNuevoTrabajo({...nuevoTrabajo, nombre: e.target.value})} placeholder="Ej: PH DELTA"/></div>
            <div className="flex-1"><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Estado</label><input required className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevoTrabajo.estado} onChange={e => setNuevoTrabajo({...nuevoTrabajo, estado: e.target.value})} placeholder="Ej: Esperando Muni"/></div>
            <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Encargado</label><select className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevoTrabajo.encargado} onChange={e => setNuevoTrabajo({...nuevoTrabajo, encargado: e.target.value})}><option>Leo</option><option>Bruno</option></select></div>
            <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Alerta</label><select className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-3 rounded focus:outline-none focus:border-[#727A4E]" value={nuevoTrabajo.color} onChange={e => setNuevoTrabajo({...nuevoTrabajo, color: e.target.value})}><option value="verde">Verde (Ingresado)</option><option value="amarillo">Amarillo (Pendiente)</option></select></div>
            <button type="submit" className={`px-6 py-3 rounded-md font-bold text-white shadow-md ${editandoTrabajoId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#727A4E] hover:bg-[#5E653F]'}`}>{editandoTrabajoId ? "Guardar Edición" : "Agregar"}</button>
            {editandoTrabajoId && <button type="button" onClick={() => {setEditandoTrabajoId(null); setNuevoTrabajo({ nombre: "", estado: "", color: "verde", encargado: "Leo" });}} className="px-6 py-3 rounded-md font-bold text-zinc-600 bg-zinc-200 hover:bg-zinc-300">Cancelar</button>}
          </form>

          <div className="grid grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-zinc-200">
              <div className="bg-[#1A1A1A] p-4 border-b-4 border-[#727A4E]"><h3 className="font-bold text-white tracking-widest uppercase text-sm">Expedientes Leo</h3></div>
              <table className="w-full text-left border-collapse">
                <tbody>{trabajosLeo.map(t => (<tr key={t.id} className="border-b border-zinc-100 hover:bg-zinc-50"><td className="p-4 font-bold text-zinc-800">{t.nombre_expediente}</td><td className="p-4"><span className={`px-3 py-1 rounded-full text-xs font-bold ${t.color_alerta === 'verde' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{t.estado_detalle}</span></td><td className="p-4 text-right"><button onClick={() => iniciarEdicionTrabajo(t)} className="text-xl hover:scale-110 transition-transform">✏️</button></td></tr>))}</tbody>
              </table>
            </div>
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-zinc-200">
              <div className="bg-[#1A1A1A] p-4 border-b-4 border-[#727A4E]"><h3 className="font-bold text-white tracking-widest uppercase text-sm">Expedientes Bruno</h3></div>
              <table className="w-full text-left border-collapse">
                <tbody>{trabajosBruno.map(t => (<tr key={t.id} className="border-b border-zinc-100 hover:bg-zinc-50"><td className="p-4 font-bold text-zinc-800">{t.nombre_expediente}</td><td className="p-4"><span className={`px-3 py-1 rounded-full text-xs font-bold ${t.color_alerta === 'verde' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{t.estado_detalle}</span></td><td className="p-4 text-right"><button onClick={() => iniciarEdicionTrabajo(t)} className="text-xl hover:scale-110 transition-transform">✏️</button></td></tr>))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: FINANZAS */}
      {activeTab === "finanzas" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-md border border-zinc-200">
            <div className="flex justify-between items-center mb-6 pb-3 border-b">
              <h2 className="font-black tracking-widest text-[#1A1A1A]">{nuevaFinanza.esGasto5050 ? "💼 CARGAR GASTO COMPARTIDO (50/50)" : "📝 CARGAR EXPEDIENTE NORMAL"}</h2>
              <button onClick={toggleGasto5050} type="button" className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full border transition-colors ${nuevaFinanza.esGasto5050 ? 'bg-zinc-800 text-white border-zinc-800' : 'bg-zinc-100 text-zinc-600 border-zinc-300 hover:bg-zinc-200'}`}>
                {nuevaFinanza.esGasto5050 ? "Volver a Expedientes" : "Cargar Gasto Compartido"}
              </button>
            </div>

            <form onSubmit={guardarFinanza} className="grid grid-cols-4 gap-4 items-end">
              {!nuevaFinanza.esGasto5050 ? (
                <>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Tipo</label><input ref={tipoInputRef} required className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-2 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.tramite} onChange={e => actualizarValoresFinanza('tramite', e.target.value)}/></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Propietario</label><input required className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-2 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.propietario} onChange={e => setNuevaFinanza({...nuevaFinanza, propietario: e.target.value})}/></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Entró por</label><select className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-2 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.encargado} onChange={e => actualizarValoresFinanza('encargado', e.target.value)}><option value="Leo">Leo</option><option value="Bruno">Bruno</option></select></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-[#727A4E]">Ingreso Total ($)</label><input type="text" inputMode="numeric" required className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-2 rounded font-black text-[#727A4E] focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.ingreso === 0 ? "" : formatearPlata(nuevaFinanza.ingreso)} onChange={e => handlePlataInput('ingreso', e.target.value)} placeholder="0"/></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Caja ($)</label><input type="text" inputMode="numeric" className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-2 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.caja === 0 ? "" : formatearPlata(nuevaFinanza.caja)} onChange={e => handlePlataInput('caja', e.target.value)} placeholder="0"/></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Colegio ($)</label><input type="text" inputMode="numeric" className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-2 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.colegio === 0 ? "" : formatearPlata(nuevaFinanza.colegio)} onChange={e => handlePlataInput('colegio', e.target.value)} placeholder="0"/></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Extra Leo ($)</label><input type="text" inputMode="numeric" className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-2 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.extraLeo === 0 ? "" : formatearPlata(nuevaFinanza.extraLeo)} onChange={e => handlePlataInput('extraLeo', e.target.value)} placeholder="0"/></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Extra Bruno ($)</label><input type="text" inputMode="numeric" className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-2 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.extraBruno === 0 ? "" : formatearPlata(nuevaFinanza.extraBruno)} onChange={e => handlePlataInput('extraBruno', e.target.value)} placeholder="0"/></div>
                </>
              ) : (
                <>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Concepto</label><input ref={tipoInputRef} required className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-2 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.tramite} onChange={e => setNuevaFinanza({...nuevaFinanza, tramite: e.target.value})}/></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-zinc-500">Pagado por</label><select className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-2 rounded focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.encargado} onChange={e => setNuevaFinanza({...nuevaFinanza, encargado: e.target.value})}><option value="Leo">Leo</option><option value="Bruno">Bruno</option></select></div>
                  <div><label className="text-xs uppercase tracking-wider font-bold text-red-600">Monto del Gasto ($)</label><input type="text" inputMode="numeric" required className="w-full border-b-2 border-zinc-200 bg-zinc-50 p-2 rounded font-black text-red-600 focus:outline-none focus:border-[#727A4E]" value={nuevaFinanza.caja === 0 ? "" : formatearPlata(nuevaFinanza.caja)} onChange={e => handlePlataInput('caja', e.target.value)} placeholder="0"/></div>
                  <div className="text-sm text-zinc-400 pb-2 italic">Se descontará 50% a cada uno.</div>
                </>
              )}
              <div className="col-span-4 flex justify-end gap-3 mt-4">
                {editandoFinanzaId && (<button type="button" onClick={() => {setEditandoFinanzaId(null); setNuevaFinanza({ tramite: "VEP", propietario: "", encargado: "Leo", ingreso: 0, caja: 83000, colegio: 69300, extraLeo: 20800, extraBruno: 0, esGasto5050: false });}} className="px-6 py-2 rounded font-bold text-zinc-600 bg-zinc-200 hover:bg-zinc-300">Cancelar</button>)}
                <button type="submit" className={`px-8 py-2.5 rounded text-white font-black tracking-widest shadow-md transition-colors ${editandoFinanzaId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#727A4E] hover:bg-[#5E653F]'}`}>{editandoFinanzaId ? "GUARDAR" : "CARGAR"}</button>
              </div>
            </form>
          </div>

          <div className="bg-[#1A1A1A] text-white rounded-xl shadow-xl p-8 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#727A4E] opacity-10 rounded-bl-full pointer-events-none"></div>
            <div className="flex gap-16 relative z-10">
              <div>
                <h4 className="text-[#727A4E] font-black tracking-widest text-sm mb-3">RESUMEN LEO</h4>
                <p className="text-sm mb-1 text-zinc-300">Cobrado: <span className="text-white font-medium">${formatearPlata(resumenActual.cobradoLeo)}</span></p>
                <p className="text-sm mb-1 text-zinc-300">Limpio Exp.: <span className="text-white font-medium">${formatearPlata(resumenActual.limpioLeoTotal)}</span></p>
                <p className="text-sm border-b border-zinc-700 pb-2 mb-2 text-zinc-300">Pagado Gral: <span className="text-white font-medium">${formatearPlata(resumenActual.gastosLeo)}</span></p>
                <p className={`font-black text-xl tracking-wide ${resumenActual.balanceLeo > 0 ? 'text-red-400' : 'text-[#A4B070]'}`}>
                  {resumenActual.balanceLeo > 0 ? `Transferir: $${formatearPlata(resumenActual.balanceLeo)}` : `A favor: $${formatearPlata(Math.abs(resumenActual.balanceLeo))}`}
                </p>
              </div>
              <div>
                <h4 className="text-[#727A4E] font-black tracking-widest text-sm mb-3">RESUMEN BRUNO</h4>
                <p className="text-sm mb-1 text-zinc-300">Cobrado: <span className="text-white font-medium">${formatearPlata(resumenActual.cobradoBruno)}</span></p>
                <p className="text-sm mb-1 text-zinc-300">Limpio Exp.: <span className="text-white font-medium">${formatearPlata(resumenActual.limpioBrunoTotal)}</span></p>
                <p className="text-sm border-b border-zinc-700 pb-2 mb-2 text-zinc-300">Pagado Gral: <span className="text-white font-medium">${formatearPlata(resumenActual.gastosBruno)}</span></p>
                <p className={`font-black text-xl tracking-wide ${resumenActual.balanceBruno > 0 ? 'text-red-400' : 'text-[#A4B070]'}`}>
                  {resumenActual.balanceBruno > 0 ? `Transferir: $${formatearPlata(resumenActual.balanceBruno)}` : `A favor: $${formatearPlata(Math.abs(resumenActual.balanceBruno))}`}
                </p>
              </div>
            </div>
            <button onClick={liquidarSemana} className="bg-white text-[#1A1A1A] hover:bg-zinc-200 px-8 py-4 rounded font-black text-lg shadow-lg tracking-widest relative z-10">CERRAR SEMANA</button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-x-auto border border-zinc-200">
            <table className="w-full text-left whitespace-nowrap">
              <thead><tr className="bg-[#27272A] text-zinc-300 uppercase text-xs tracking-wider border-b"><th className="p-4">Tipo</th><th className="p-4">Propietario / Pagó</th><th className="p-4">Ingreso / Costo</th><th className="p-4">Gastos Trámite</th><th className="p-4 text-white">Limpio Leo</th><th className="p-4 text-white">Limpio Bruno</th><th className="p-4 w-16">Acción</th></tr></thead>
              <tbody>
                {finanzas.map((f) => {
                  const partes = calcularPartes(f);
                  return (
                    <tr key={f.id} className={`border-b border-zinc-100 hover:bg-zinc-50 ${f.es_gasto_5050 ? 'bg-zinc-50' : ''}`}>
                      <td className="p-4 font-bold text-zinc-800">{f.tipo_tramite} {f.es_gasto_5050 && <span className="ml-2 text-xs bg-[#727A4E]/20 text-[#727A4E] px-2 py-1 rounded">50/50</span>}</td>
                      <td className="p-4 text-zinc-600">{f.es_gasto_5050 ? <span className="font-bold">Pagó {f.encargado}</span> : f.propietario}</td>
                      <td className={`p-4 font-black ${f.es_gasto_5050 ? 'text-red-500' : 'text-zinc-800'}`}>${formatearPlata(f.es_gasto_5050 ? f.caja : f.ingreso_total)}</td>
                      <td className="p-4 text-zinc-400">{f.es_gasto_5050 ? '-' : `$${formatearPlata(partes.totalAportes)}`}</td>
                      <td className={`p-4 font-bold ${partes.limpioLeo < 0 ? 'text-red-500' : 'text-[#727A4E]'}`}>${f.es_gasto_5050 ? '$0' : formatearPlata(partes.limpioLeo)}</td>
                      <td className={`p-4 font-bold ${partes.limpioBruno < 0 ? 'text-red-500' : 'text-[#727A4E]'}`}>${f.es_gasto_5050 ? '$0' : formatearPlata(partes.limpioBruno)}</td>
                      <td className="p-4 flex gap-3">
                        <button onClick={() => iniciarEdicionFinanza(f)} className="text-lg opacity-60 hover:opacity-100 transition-opacity" title="Editar">✏️</button>
                        <button onClick={() => eliminarFinanza(f.id)} className="text-lg opacity-60 hover:opacity-100 transition-opacity" title="Borrar">🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA: HISTORIAL */}
      {activeTab === "historial" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-black tracking-widest text-[#1A1A1A] mb-6 uppercase">Trabajos Liquidados</h2>
          
          {fechasOrdenadas.map(fechaKey => {
            const trabajosDelBloque = historialAgrupado[fechaKey];
            const tituloBloque = fechaKey === "anterior" ? "Liquidaciones Anteriores (Sin fecha)" : `Liquidación ${new Date(fechaKey).toLocaleDateString("es-AR")}`;
            const estaAbierto = semanasAbiertas[fechaKey] || false;
            const resumenBloque = generarResumen(trabajosDelBloque);

            return (
              <div key={fechaKey} className="bg-white rounded-xl shadow-md overflow-hidden border border-zinc-200">
                <div className="bg-[#1A1A1A] p-5 border-b-4 border-[#727A4E] flex justify-between items-center text-white">
                  <h3 onClick={() => toggleHistorial(fechaKey)} className="font-bold text-lg cursor-pointer flex-1 tracking-widest uppercase flex items-center gap-3">
                    {tituloBloque} <span className="text-[#727A4E] text-xs font-bold px-2 py-1 bg-[#27272A] rounded">({trabajosDelBloque.length}) {estaAbierto ? '▼' : '▶'}</span>
                  </h3>
                  
                  <div className="flex gap-3">
                    <button onClick={() => reabrirSemana(fechaKey)} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-1.5 text-xs tracking-wider font-bold rounded transition-colors uppercase">Reabrir</button>
                    <button onClick={() => eliminarSemana(fechaKey)} className="bg-red-900/40 hover:bg-red-900/80 text-red-200 px-4 py-1.5 text-xs tracking-wider font-bold rounded transition-colors uppercase">Borrar</button>
                  </div>
                </div>
                
                {estaAbierto && (
                  <div>
                    <div className="bg-zinc-50 p-6 border-b border-zinc-200 flex justify-around">
                      <div className="text-center">
                        <span className="text-xs font-black tracking-widest text-zinc-400 block mb-1">BALANCE LEO (CERRADO)</span>
                        <span className={`font-black text-xl ${resumenBloque.balanceLeo > 0 ? 'text-red-500' : 'text-[#727A4E]'}`}>
                          {resumenBloque.balanceLeo > 0 ? `Transfirió: $${formatearPlata(resumenBloque.balanceLeo)}` : `Recibió: $${formatearPlata(Math.abs(resumenBloque.balanceLeo))}`}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-black tracking-widest text-zinc-400 block mb-1">BALANCE BRUNO (CERRADO)</span>
                        <span className={`font-black text-xl ${resumenBloque.balanceBruno > 0 ? 'text-red-500' : 'text-[#727A4E]'}`}>
                          {resumenBloque.balanceBruno > 0 ? `Transfirió: $${formatearPlata(resumenBloque.balanceBruno)}` : `Recibió: $${formatearPlata(Math.abs(resumenBloque.balanceBruno))}`}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left whitespace-nowrap">
                        <thead><tr className="bg-white text-zinc-400 uppercase text-xs tracking-wider border-b border-zinc-200"><th className="p-4">Tipo</th><th className="p-4">Propietario</th><th className="p-4">Entró Por</th><th className="p-4">Total/Gasto</th><th className="p-4">Limpio Leo</th><th className="p-4">Limpio Bruno</th></tr></thead>
                        <tbody>
                          {trabajosDelBloque.map((h: any) => {
                            const partes = calcularPartes(h);
                            return (
                              <tr key={h.id} className={`border-b border-zinc-100 ${h.es_gasto_5050 ? 'bg-zinc-50' : ''}`}>
                                <td className="p-4 font-bold text-zinc-700">{h.tipo_tramite} {h.es_gasto_5050 && <span className="ml-2 text-xs bg-[#727A4E]/20 text-[#727A4E] px-2 py-1 rounded">50/50</span>}</td>
                                <td className="p-4 text-zinc-600">{h.es_gasto_5050 ? `Pagó ${h.encargado}` : h.propietario}</td>
                                <td className="p-4 text-zinc-500">{h.es_gasto_5050 ? '-' : h.encargado}</td>
                                <td className={`p-4 font-bold ${h.es_gasto_5050 ? 'text-red-500' : 'text-zinc-800'}`}>${formatearPlata(h.es_gasto_5050 ? h.caja : h.ingreso_total)}</td>
                                <td className="p-4 text-zinc-700">${h.es_gasto_5050 ? '$0' : formatearPlata(partes.limpioLeo)}</td>
                                <td className="p-4 text-zinc-700">${h.es_gasto_5050 ? '$0' : formatearPlata(partes.limpioBruno)}</td>
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