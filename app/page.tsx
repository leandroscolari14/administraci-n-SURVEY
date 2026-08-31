"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function DashboardAgrimensura() {
  const [activeTab, setActiveTab] = useState("finanzas");
  const [trabajos, setTrabajos] = useState<any[]>([]);
  const [finanzas, setFinanzas] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  
  // Estado para manejar qué semanas están abiertas en el historial
  const [semanasAbiertas, setSemanasAbiertas] = useState<Record<string, boolean>>({});

  const tipoInputRef = useRef<HTMLInputElement>(null);

  const [nuevoTrabajo, setNuevoTrabajo] = useState({ nombre: "", estado: "", color: "verde", encargado: "Leo" });
  const [editandoTrabajoId, setEditandoTrabajoId] = useState<string | null>(null);
  
  const [editandoFinanzaId, setEditandoFinanzaId] = useState<string | null>(null);
  
  // Agregamos el estado esGasto5050
  const [nuevaFinanza, setNuevaFinanza] = useState({ 
    tramite: "VEP", propietario: "", encargado: "Leo", ingreso: 0, caja: 83000, colegio: 69300, extraLeo: 20800, extraBruno: 0, esGasto5050: false
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const { data: dataTrabajos } = await supabase.from("trabajos_curso").select("*").order("fecha_actualizacion", { ascending: false });
    const { data: dataFinanzas } = await supabase.from("finanzas").select("*").eq("liquidado", false).order("fecha_carga", { ascending: false });
    const { data: dataHistorial } = await supabase.from("finanzas").select("*").eq("liquidado", true).order("fecha_liquidacion", { ascending: false });
    
    if (dataTrabajos) setTrabajos(dataTrabajos);
    if (dataFinanzas) setFinanzas(dataFinanzas);
    if (dataHistorial) setHistorial(dataHistorial);
  };

  const formatearPlata = (monto: any) => new Intl.NumberFormat("es-AR").format(Number(monto));

  // Función para manejar el tipeo con formato de miles
  const handlePlataInput = (campo: string, valorStr: string) => {
    const valorLimpio = valorStr.replace(/\D/g, ''); // Deja solo los números
    setNuevaFinanza({ ...nuevaFinanza, [campo]: Number(valorLimpio) });
  };

  const actualizarValoresFinanza = (campo: string, valor: string) => {
    let nuevoTramite = campo === 'tramite' ? valor : nuevaFinanza.tramite;
    let nuevoEncargado = campo === 'encargado' ? valor : nuevaFinanza.encargado;
    
    let eLeo = 0, eBruno = 0;
    const esREP = nuevoTramite.toUpperCase().includes("REP");
    
    if (nuevoEncargado === "Leo") {
      eLeo = 20800; eBruno = esREP ? 11700 : 0;
    } else {
      eLeo = 0; eBruno = esREP ? (20800 + 11700) : 20800;
    }

    setNuevaFinanza({ ...nuevaFinanza, [campo]: valor, extraLeo: eLeo, extraBruno: eBruno });
  };

  const toggleGasto5050 = () => {
    if (!nuevaFinanza.esGasto5050) {
      setNuevaFinanza({ ...nuevaFinanza, esGasto5050: true, tramite: "Cuota CAJA", ingreso: 0, caja: 0, colegio: 0, extraLeo: 0, extraBruno: 0, propietario: "-" });
    } else {
      setNuevaFinanza({ ...nuevaFinanza, esGasto5050: false, tramite: "VEP", propietario: "", ingreso: 0, caja: 83000, colegio: 69300, extraLeo: 20800, extraBruno: 0 });
    }
  };

  // ---- FUNCIONES TRABAJOS ----
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

  // ---- FUNCIONES FINANZAS ----
  const guardarFinanza = async (e: any) => {
    e.preventDefault();
    const datosGuardar = {
      tipo_tramite: nuevaFinanza.tramite, propietario: nuevaFinanza.propietario, encargado: nuevaFinanza.encargado,
      ingreso_total: nuevaFinanza.ingreso, caja: nuevaFinanza.caja, colegio: nuevaFinanza.colegio, 
      extra_leo: nuevaFinanza.extraLeo, extra_bruno: nuevaFinanza.extraBruno, es_gasto_5050: nuevaFinanza.esGasto5050
    };

    if (editandoFinanzaId) {
      await supabase.from("finanzas").update(datosGuardar).eq("id", editandoFinanzaId);
      setEditandoFinanzaId(null);
    } else {
      await supabase.from("finanzas").insert([datosGuardar]);
    }
    setNuevaFinanza({ tramite: "VEP", propietario: "", encargado: "Leo", ingreso: 0, caja: 83000, colegio: 69300, extraLeo: 20800, extraBruno: 0, esGasto5050: false });
    cargarDatos();
    
    setTimeout(() => { tipoInputRef.current?.focus(); }, 100);
  };

  const iniciarEdicionFinanza = (f: any) => {
    setEditandoFinanzaId(f.id);
    setNuevaFinanza({ 
      tramite: f.tipo_tramite, propietario: f.propietario, encargado: f.encargado, 
      ingreso: Number(f.ingreso_total), caja: Number(f.caja), colegio: Number(f.colegio), 
      extraLeo: Number(f.extra_leo || 0), extraBruno: Number(f.extra_bruno || 0), esGasto5050: f.es_gasto_5050 || false
    });
  };

  const eliminarFinanza = async (id: string) => {
    if (confirm("¿Estás seguro de borrar este registro?")) {
      await supabase.from("finanzas").delete().eq("id", id);
      cargarDatos();
    }
  };

  const liquidarSemana = async () => {
    if (finanzas.length === 0) return alert("No hay trabajos pendientes para liquidar esta semana.");
    if (confirm("¿Estás seguro de liquidar? Se cerrarán las cuentas y los trabajos pasarán al historial.")) {
      const ids = finanzas.map(f => f.id);
      const fechaCierre = new Date().toISOString(); 
      await supabase.from("finanzas").update({ liquidado: true, fecha_liquidacion: fechaCierre }).in("id", ids);
      cargarDatos();
      alert("¡Semana liquidada con éxito! Cuentas en 0.");
    }
  };

  // ---- CALCULOS ----
  const calcularPartes = (f: any) => {
    if (f.es_gasto_5050) {
      // Si es un gasto 50/50, usamos la cajita "caja" para guardar el monto total del gasto
      const montoGasto = Number(f.caja);
      return {
        totalAportes: montoGasto, // El gasto total pagado
        limpioLeo: -(montoGasto / 2), // Le restamos su mitad a la ganancia
        limpioBruno: -(montoGasto / 2) // Le restamos su mitad a la ganancia
      };
    } else {
      // Expediente normal
      const totalAportes = Number(f.caja) + Number(f.colegio) + Number(f.extra_leo || 0) + Number(f.extra_bruno || 0);
      const limpio = Number(f.ingreso_total) - totalAportes;
      return {
        totalAportes: Math.round(totalAportes),
        limpioLeo: Math.round(f.encargado === "Leo" ? limpio * 0.70 : limpio * 0.20),
        limpioBruno: Math.round(f.encargado === "Bruno" ? limpio * 0.80 : limpio * 0.30)
      };
    }
  };

  let cobradoLeo = 0, limpioLeoTotal = 0, gastosLeo = 0;
  let cobradoBruno = 0, limpioBrunoTotal = 0, gastosBruno = 0;

  finanzas.forEach(f => {
    const partes = calcularPartes(f);
    limpioLeoTotal += partes.limpioLeo;
    limpioBrunoTotal += partes.limpioBruno;
    
    if (f.es_gasto_5050) {
      // El que lo pagó, suma a sus gastos salientes
      if (f.encargado === "Leo") gastosLeo += partes.totalAportes;
      else gastosBruno += partes.totalAportes;
    } else {
      if (f.encargado === "Leo") {
        cobradoLeo += Number(f.ingreso_total); gastosLeo += partes.totalAportes;
      } else {
        cobradoBruno += Number(f.ingreso_total); gastosBruno += partes.totalAportes;
      }
    }
  });

  const balanceLeo = cobradoLeo - limpioLeoTotal - gastosLeo;
  const balanceBruno = cobradoBruno - limpioBrunoTotal - gastosBruno;

  const trabajosLeo = trabajos.filter(t => t.encargado === "Leo");
  const trabajosBruno = trabajos.filter(t => t.encargado === "Bruno");

  // ---- AGRUPAR HISTORIAL ----
  const historialAgrupado = historial.reduce((acc, item) => {
    const key = item.fecha_liquidacion || "anterior";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const fechasOrdenadas = Object.keys(historialAgrupado).sort((a, b) => {
    if (a === "anterior") return 1;
    if (b === "anterior") return -1;
    return new Date(b).getTime() - new Date(a).getTime();
  });

  const toggleHistorial = (fechaKey: string) => {
    setSemanasAbiertas({ ...semanasAbiertas, [fechaKey]: !semanasAbiertas[fechaKey] });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-800">
      <header className="mb-8 flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-slate-900">Estudio de Agrimensura</h1><p className="text-slate-500">Panel de Gestión Integral</p></div>
        <div className="flex gap-4">
          <button onClick={() => setActiveTab("trabajos")} className={`px-4 py-2 rounded-md font-semibold ${activeTab === "trabajos" ? "bg-slate-800 text-white" : "bg-white border text-slate-600"}`}>Expedientes en Curso</button>
          <button onClick={() => setActiveTab("finanzas")} className={`px-4 py-2 rounded-md font-semibold ${activeTab === "finanzas" ? "bg-slate-800 text-white" : "bg-white border text-slate-600"}`}>Finanzas (Semana Actual)</button>
          <button onClick={() => setActiveTab("historial")} className={`px-4 py-2 rounded-md font-semibold ${activeTab === "historial" ? "bg-slate-800 text-white" : "bg-white border text-slate-600"}`}>Historial</button>
        </div>
      </header>

      {/* PESTAÑA: TRABAJOS EN CURSO */}
      {activeTab === "trabajos" && (
        <div className="space-y-8">
           <form onSubmit={guardarTrabajo} className="bg-white p-4 rounded-lg shadow border flex gap-4 items-end">
            <div className="flex-1"><label className="text-sm font-bold">Expediente</label><input required className="w-full border p-2 rounded" value={nuevoTrabajo.nombre} onChange={e => setNuevoTrabajo({...nuevoTrabajo, nombre: e.target.value})} placeholder="Ej: PH DELTA"/></div>
            <div className="flex-1"><label className="text-sm font-bold">Estado</label><input required className="w-full border p-2 rounded" value={nuevoTrabajo.estado} onChange={e => setNuevoTrabajo({...nuevoTrabajo, estado: e.target.value})} placeholder="Ej: Esperando Muni"/></div>
            <div><label className="text-sm font-bold">Encargado</label><select className="w-full border p-2 rounded" value={nuevoTrabajo.encargado} onChange={e => setNuevoTrabajo({...nuevoTrabajo, encargado: e.target.value})}><option>Leo</option><option>Bruno</option></select></div>
            <div><label className="text-sm font-bold">Alerta</label><select className="w-full border p-2 rounded" value={nuevoTrabajo.color} onChange={e => setNuevoTrabajo({...nuevoTrabajo, color: e.target.value})}><option value="verde">Verde (Ingresado)</option><option value="amarillo">Amarillo (Pendiente)</option></select></div>
            <button type="submit" className={`px-4 py-2 rounded font-bold text-white ${editandoTrabajoId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{editandoTrabajoId ? "Guardar Edición" : "Agregar"}</button>
            {editandoTrabajoId && <button type="button" onClick={() => {setEditandoTrabajoId(null); setNuevoTrabajo({ nombre: "", estado: "", color: "verde", encargado: "Leo" });}} className="px-4 py-2 rounded font-bold text-slate-600 bg-slate-200 hover:bg-slate-300">Cancelar</button>}
          </form>

          <div className="grid grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow border overflow-hidden">
              <div className="bg-[#e0f2fe] p-3 border-b border-slate-200"><h3 className="font-bold text-blue-900 text-lg">Expedientes Leo</h3></div>
              <table className="w-full text-left border-collapse">
                <thead><tr className="bg-slate-50 uppercase text-xs text-slate-500"><th className="p-3 border-b">Expediente</th><th className="p-3 border-b">Estado</th><th className="p-3 border-b w-16">Acción</th></tr></thead>
                <tbody>{trabajosLeo.map(t => (<tr key={t.id} className="border-b"><td className="p-3 font-bold">{t.nombre_expediente}</td><td className={`p-3 text-sm font-medium ${t.color_alerta === 'verde' ? 'bg-[#c6f6d5]' : 'bg-[#fefcbf]'}`}>{t.estado_detalle}</td><td className="p-3"><button onClick={() => iniciarEdicionTrabajo(t)} className="text-xl hover:scale-110 transition-transform">✏️</button></td></tr>))}</tbody>
              </table>
            </div>
            <div className="bg-white rounded-lg shadow border overflow-hidden">
              <div className="bg-[#ffe4e6] p-3 border-b border-slate-200"><h3 className="font-bold text-red-900 text-lg">Expedientes Bruno</h3></div>
              <table className="w-full text-left border-collapse">
                <thead><tr className="bg-slate-50 uppercase text-xs text-slate-500"><th className="p-3 border-b">Expediente</th><th className="p-3 border-b">Estado</th><th className="p-3 border-b w-16">Acción</th></tr></thead>
                <tbody>{trabajosBruno.map(t => (<tr key={t.id} className="border-b"><td className="p-3 font-bold">{t.nombre_expediente}</td><td className={`p-3 text-sm font-medium ${t.color_alerta === 'verde' ? 'bg-[#c6f6d5]' : 'bg-[#fefcbf]'}`}>{t.estado_detalle}</td><td className="p-3"><button onClick={() => iniciarEdicionTrabajo(t)} className="text-xl hover:scale-110 transition-transform">✏️</button></td></tr>))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: FINANZAS */}
      {activeTab === "finanzas" && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h2 className="font-bold text-lg">{nuevaFinanza.esGasto5050 ? "💼 Cargar Gasto Compartido (50/50)" : "📝 Cargar Expediente Normal"}</h2>
              <button onClick={toggleGasto5050} type="button" className={`px-4 py-1 text-sm font-bold rounded-full border ${nuevaFinanza.esGasto5050 ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                {nuevaFinanza.esGasto5050 ? "Volver a Expedientes" : "Cargar Gasto Compartido"}
              </button>
            </div>

            <form onSubmit={guardarFinanza} className="grid grid-cols-4 gap-4 items-end">
              
              {!nuevaFinanza.esGasto5050 ? (
                <>
                  {/* FORMULARIO NORMAL */}
                  <div><label className="text-sm font-bold">Tipo</label><input ref={tipoInputRef} required className="w-full border p-2 rounded" value={nuevaFinanza.tramite} onChange={e => actualizarValoresFinanza('tramite', e.target.value)}/></div>
                  <div><label className="text-sm font-bold">Propietario</label><input required className="w-full border p-2 rounded" value={nuevaFinanza.propietario} onChange={e => setNuevaFinanza({...nuevaFinanza, propietario: e.target.value})}/></div>
                  <div><label className="text-sm font-bold">Entró por:</label><select className="w-full border p-2 rounded" value={nuevaFinanza.encargado} onChange={e => actualizarValoresFinanza('encargado', e.target.value)}><option value="Leo">Leo</option><option value="Bruno">Bruno</option></select></div>
                  <div><label className="text-sm font-bold">Ingreso Total ($)</label><input type="text" inputMode="numeric" required className="w-full border p-2 rounded font-bold text-green-700" value={nuevaFinanza.ingreso === 0 ? "" : formatearPlata(nuevaFinanza.ingreso)} onChange={e => handlePlataInput('ingreso', e.target.value)} placeholder="0"/></div>
                  <div><label className="text-sm font-bold">Caja ($)</label><input type="text" inputMode="numeric" className="w-full border p-2 rounded" value={nuevaFinanza.caja === 0 ? "" : formatearPlata(nuevaFinanza.caja)} onChange={e => handlePlataInput('caja', e.target.value)} placeholder="0"/></div>
                  <div><label className="text-sm font-bold">Colegio ($)</label><input type="text" inputMode="numeric" className="w-full border p-2 rounded" value={nuevaFinanza.colegio === 0 ? "" : formatearPlata(nuevaFinanza.colegio)} onChange={e => handlePlataInput('colegio', e.target.value)} placeholder="0"/></div>
                  <div><label className="text-sm font-bold">Extra Leo ($)</label><input type="text" inputMode="numeric" className="w-full border p-2 rounded" value={nuevaFinanza.extraLeo === 0 ? "" : formatearPlata(nuevaFinanza.extraLeo)} onChange={e => handlePlataInput('extraLeo', e.target.value)} placeholder="0"/></div>
                  <div><label className="text-sm font-bold">Extra Bruno ($)</label><input type="text" inputMode="numeric" className="w-full border p-2 rounded" value={nuevaFinanza.extraBruno === 0 ? "" : formatearPlata(nuevaFinanza.extraBruno)} onChange={e => handlePlataInput('extraBruno', e.target.value)} placeholder="0"/></div>
                </>
              ) : (
                <>
                  {/* FORMULARIO 50/50 */}
                  <div><label className="text-sm font-bold">Concepto (Ej: Cuota Caja)</label><input ref={tipoInputRef} required className="w-full border p-2 rounded" value={nuevaFinanza.tramite} onChange={e => setNuevaFinanza({...nuevaFinanza, tramite: e.target.value})}/></div>
                  <div><label className="text-sm font-bold">Pagado por:</label><select className="w-full border p-2 rounded" value={nuevaFinanza.encargado} onChange={e => setNuevaFinanza({...nuevaFinanza, encargado: e.target.value})}><option value="Leo">Leo</option><option value="Bruno">Bruno</option></select></div>
                  <div><label className="text-sm font-bold text-red-600">Monto del Gasto ($)</label><input type="text" inputMode="numeric" required className="w-full border p-2 rounded font-bold text-red-600" value={nuevaFinanza.caja === 0 ? "" : formatearPlata(nuevaFinanza.caja)} onChange={e => handlePlataInput('caja', e.target.value)} placeholder="0"/></div>
                  <div className="text-sm text-slate-500 pb-2">Se le descontará exactamente el 50% de este monto a cada uno.</div>
                </>
              )}
              
              <div className="col-span-4 flex justify-end gap-2 mt-2">
                {editandoFinanzaId && (<button type="button" onClick={() => {setEditandoFinanzaId(null); setNuevaFinanza({ tramite: "VEP", propietario: "", encargado: "Leo", ingreso: 0, caja: 83000, colegio: 69300, extraLeo: 20800, extraBruno: 0, esGasto5050: false });}} className="px-6 py-2 rounded font-bold text-slate-600 bg-slate-200 hover:bg-slate-300">Cancelar</button>)}
                <button type="submit" className={`px-6 py-2 rounded font-bold text-white ${editandoFinanzaId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{editandoFinanzaId ? "Guardar Edición" : "Cargar"}</button>
              </div>
            </form>
          </div>

          {/* CUADRO DE LIQUIDACIÓN Y BOTÓN */}
          <div className="bg-slate-800 text-white rounded-lg shadow-lg p-6 flex items-center justify-between">
            <div className="flex gap-12">
              <div>
                <h4 className="text-slate-400 font-bold text-sm mb-2">RESUMEN LEO</h4>
                <p className="text-sm">Cobrado: ${formatearPlata(cobradoLeo)}</p>
                <p className="text-sm">Limpio: ${formatearPlata(limpioLeoTotal)}</p>
                <p className="text-sm border-b border-slate-600 pb-1 mb-1">Gastos (Propios y 50/50): ${formatearPlata(gastosLeo)}</p>
                <p className={`font-bold text-lg ${balanceLeo > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {balanceLeo > 0 ? `A transferir: $${formatearPlata(balanceLeo)}` : `A favor: $${formatearPlata(Math.abs(balanceLeo))}`}
                </p>
              </div>
              <div>
                <h4 className="text-slate-400 font-bold text-sm mb-2">RESUMEN BRUNO</h4>
                <p className="text-sm">Cobrado: ${formatearPlata(cobradoBruno)}</p>
                <p className="text-sm">Limpio: ${formatearPlata(limpioBrunoTotal)}</p>
                <p className="text-sm border-b border-slate-600 pb-1 mb-1">Gastos (Propios y 50/50): ${formatearPlata(gastosBruno)}</p>
                <p className={`font-bold text-lg ${balanceBruno > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {balanceBruno > 0 ? `A transferir: $${formatearPlata(balanceBruno)}` : `A favor: $${formatearPlata(Math.abs(balanceBruno))}`}
                </p>
              </div>
            </div>
            <button onClick={liquidarSemana} className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-xl font-black text-lg shadow-lg transition-transform hover:scale-105">💰 CERRAR SEMANA</button>
          </div>

          <div className="bg-white rounded-lg shadow border overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead><tr className="bg-slate-100 uppercase text-xs border-b"><th className="p-4">Tipo</th><th className="p-4">Propietario / Pagó</th><th className="p-4">Ingreso / Costo</th><th className="p-4">Gastos Trámite</th><th className="p-4 text-blue-700">Limpio Leo</th><th className="p-4 text-red-700">Limpio Bruno</th><th className="p-4 w-16">Acción</th></tr></thead>
              <tbody>
                {finanzas.map((f) => {
                  const partes = calcularPartes(f);
                  return (
                    <tr key={f.id} className={`border-b ${f.es_gasto_5050 ? 'bg-indigo-50' : (f.encargado === 'Leo' ? 'bg-[#e0f2fe]' : 'bg-[#ffe4e6]')}`}>
                      <td className="p-4 font-bold">{f.tipo_tramite} {f.es_gasto_5050 && <span className="ml-2 text-xs bg-indigo-200 text-indigo-800 px-2 py-1 rounded">50/50</span>}</td>
                      <td className="p-4">{f.es_gasto_5050 ? <span className="font-semibold text-slate-600">Lo pagó {f.encargado}</span> : f.propietario}</td>
                      <td className={`p-4 font-bold ${f.es_gasto_5050 ? 'text-red-600' : 'text-slate-800'}`}>${formatearPlata(f.es_gasto_5050 ? f.caja : f.ingreso_total)}</td>
                      <td className="p-4 text-slate-600">{f.es_gasto_5050 ? '-' : `$${formatearPlata(partes.totalAportes)}`}</td>
                      <td className={`p-4 font-bold ${partes.limpioLeo < 0 ? 'text-red-500' : 'text-blue-800'}`}>${formatearPlata(partes.limpioLeo)}</td>
                      <td className={`p-4 font-bold ${partes.limpioBruno < 0 ? 'text-red-500' : 'text-red-800'}`}>${formatearPlata(partes.limpioBruno)}</td>
                      <td className="p-4 flex gap-2">
                        <button onClick={() => iniciarEdicionFinanza(f)} className="text-xl hover:scale-110 transition-transform" title="Editar">✏️</button>
                        <button onClick={() => eliminarFinanza(f.id)} className="text-xl hover:scale-110 transition-transform" title="Borrar">🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA: HISTORIAL CON ACORDEON */}
      {activeTab === "historial" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Trabajos Liquidados</h2>
          
          {fechasOrdenadas.map(fechaKey => {
            const trabajosDelBloque = historialAgrupado[fechaKey];
            const tituloBloque = fechaKey === "anterior" 
              ? "Liquidaciones Anteriores (Sin fecha)" 
              : `Liquidación del ${new Date(fechaKey).toLocaleDateString("es-AR")}`;
            
            const estaAbierto = semanasAbiertas[fechaKey] || false;

            return (
              <div key={fechaKey} className="bg-white rounded-lg shadow border overflow-hidden">
                {/* CABECERA CLICKABLE DEL ACORDEON */}
                <div 
                  onClick={() => toggleHistorial(fechaKey)} 
                  className="bg-slate-200 p-4 border-b border-slate-300 cursor-pointer hover:bg-slate-300 transition-colors flex justify-between items-center"
                >
                  <h3 className="font-bold text-slate-800 text-md">{tituloBloque}</h3>
                  <span className="text-slate-500 font-bold text-sm">
                    {estaAbierto ? '▼ Ocultar' : '▶ Ver Detalle'} ({trabajosDelBloque.length} items)
                  </span>
                </div>
                
                {/* TABLA OCULTA/VISIBLE */}
                {estaAbierto && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead><tr className="bg-slate-50 uppercase text-xs border-b text-slate-500"><th className="p-3">Tipo</th><th className="p-3">Propietario</th><th className="p-3">Entró Por</th><th className="p-3">Total / Gasto</th><th className="p-3">Limpio Leo</th><th className="p-3">Limpio Bruno</th></tr></thead>
                      <tbody>
                        {trabajosDelBloque.map((h: any) => {
                          const partes = calcularPartes(h);
                          return (
                            <tr key={h.id} className={`border-b text-slate-600 ${h.es_gasto_5050 ? 'bg-indigo-50' : ''}`}>
                              <td className="p-3 font-bold">{h.tipo_tramite} {h.es_gasto_5050 && <span className="ml-2 text-xs bg-indigo-200 text-indigo-800 px-2 py-1 rounded">50/50</span>}</td>
                              <td className="p-3">{h.es_gasto_5050 ? `Pagó ${h.encargado}` : h.propietario}</td>
                              <td className="p-3">{h.es_gasto_5050 ? '-' : h.encargado}</td>
                              <td className={`p-3 font-bold ${h.es_gasto_5050 ? 'text-red-500' : ''}`}>${formatearPlata(h.es_gasto_5050 ? h.caja : h.ingreso_total)}</td>
                              <td className="p-3">${formatearPlata(partes.limpioLeo)}</td>
                              <td className="p-3">${formatearPlata(partes.limpioBruno)}</td>
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
}