"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function DashboardAgrimensura() {
  const [activeTab, setActiveTab] = useState("finanzas");
  const [trabajos, setTrabajos] = useState<any[]>([]);
  const [finanzas, setFinanzas] = useState<any[]>([]);

  // Estados Trabajos
  const [nuevoTrabajo, setNuevoTrabajo] = useState({ nombre: "", estado: "", color: "verde", encargado: "Leo" });
  const [editandoTrabajoId, setEditandoTrabajoId] = useState<string | null>(null);
  
  // Estados Finanzas
  const [editandoFinanzaId, setEditandoFinanzaId] = useState<string | null>(null);
  const [nuevaFinanza, setNuevaFinanza] = useState({ 
    tramite: "VEP", 
    propietario: "", 
    encargado: "Leo", 
    ingreso: 0, 
    caja: 83000, 
    colegio: 69300, 
    extraLeo: 20800, 
    extraBruno: 0 
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const { data: dataTrabajos } = await supabase.from("trabajos_curso").select("*").order("fecha_actualizacion", { ascending: false });
    const { data: dataFinanzas } = await supabase.from("finanzas").select("*").eq("liquidado", false).order("fecha_carga", { ascending: false });
    
    if (dataTrabajos) setTrabajos(dataTrabajos);
    if (dataFinanzas) setFinanzas(dataFinanzas);
  };

  const actualizarValoresFinanza = (campo: string, valor: string) => {
    let nuevoTramite = campo === 'tramite' ? valor : nuevaFinanza.tramite;
    let nuevoEncargado = campo === 'encargado' ? valor : nuevaFinanza.encargado;
    
    let eLeo = 0;
    let eBruno = 0;
    const esREP = nuevoTramite.toUpperCase().includes("REP");
    
    if (nuevoEncargado === "Leo") {
      eLeo = 20800;
      eBruno = esREP ? 11700 : 0;
    } else {
      eLeo = 0;
      eBruno = esREP ? (20800 + 11700) : 20800;
    }

    setNuevaFinanza({
      ...nuevaFinanza,
      [campo]: valor,
      extraLeo: eLeo,
      extraBruno: eBruno
    });
  };

  // ---- FUNCIONES DE TRABAJOS ----
  const guardarTrabajo = async (e: any) => {
    e.preventDefault();
    if (editandoTrabajoId) {
      await supabase.from("trabajos_curso").update({
        nombre_expediente: nuevoTrabajo.nombre, estado_detalle: nuevoTrabajo.estado,
        color_alerta: nuevoTrabajo.color, encargado: nuevoTrabajo.encargado
      }).eq("id", editandoTrabajoId);
      setEditandoTrabajoId(null);
    } else {
      await supabase.from("trabajos_curso").insert([{
        nombre_expediente: nuevoTrabajo.nombre, estado_detalle: nuevoTrabajo.estado,
        color_alerta: nuevoTrabajo.color, encargado: nuevoTrabajo.encargado
      }]);
    }
    setNuevoTrabajo({ nombre: "", estado: "", color: "verde", encargado: "Leo" });
    cargarDatos();
  };

  const iniciarEdicionTrabajo = (t: any) => {
    setEditandoTrabajoId(t.id);
    setNuevoTrabajo({ nombre: t.nombre_expediente, estado: t.estado_detalle, color: t.color_alerta, encargado: t.encargado || "Leo" });
  };

  // ---- FUNCIONES DE FINANZAS ----
  const guardarFinanza = async (e: any) => {
    e.preventDefault();
    if (editandoFinanzaId) {
      await supabase.from("finanzas").update({
        tipo_tramite: nuevaFinanza.tramite, 
        propietario: nuevaFinanza.propietario, 
        encargado: nuevaFinanza.encargado,
        ingreso_total: nuevaFinanza.ingreso, 
        caja: nuevaFinanza.caja, 
        colegio: nuevaFinanza.colegio, 
        extra_leo: nuevaFinanza.extraLeo,
        extra_bruno: nuevaFinanza.extraBruno
      }).eq("id", editandoFinanzaId);
      setEditandoFinanzaId(null);
    } else {
      await supabase.from("finanzas").insert([{
        tipo_tramite: nuevaFinanza.tramite, 
        propietario: nuevaFinanza.propietario, 
        encargado: nuevaFinanza.encargado,
        ingreso_total: nuevaFinanza.ingreso, 
        caja: nuevaFinanza.caja, 
        colegio: nuevaFinanza.colegio, 
        extra_leo: nuevaFinanza.extraLeo,
        extra_bruno: nuevaFinanza.extraBruno
      }]);
    }
    setNuevaFinanza({ tramite: "VEP", propietario: "", encargado: "Leo", ingreso: 0, caja: 83000, colegio: 69300, extraLeo: 20800, extraBruno: 0 });
    cargarDatos();
  };

  const iniciarEdicionFinanza = (f: any) => {
    setEditandoFinanzaId(f.id);
    setNuevaFinanza({ 
      tramite: f.tipo_tramite, 
      propietario: f.propietario, 
      encargado: f.encargado, 
      ingreso: Number(f.ingreso_total), 
      caja: Number(f.caja), 
      colegio: Number(f.colegio), 
      extraLeo: Number(f.extra_leo || 0), 
      extraBruno: Number(f.extra_bruno || 0) 
    });
  };

  const liquidarSemana = async () => {
    if (confirm("¿Estás seguro de liquidar y cerrar esta semana? Los trabajos pasarán al historial.")) {
      const ids = finanzas.map(f => f.id);
      await supabase.from("finanzas").update({ liquidado: true }).in("id", ids);
      cargarDatos();
      alert("¡Semana liquidada con éxito! Cuenta en 0.");
    }
  };

  const calcularPartes = (f: any) => {
    const totalAportes = Number(f.caja) + Number(f.colegio) + Number(f.extra_leo || 0) + Number(f.extra_bruno || 0);
    const limpio = Number(f.ingreso_total) - totalAportes;
    return {
      totalAportes,
      limpioLeo: f.encargado === "Leo" ? limpio * 0.70 : limpio * 0.20,
      limpioBruno: f.encargado === "Bruno" ? limpio * 0.80 : limpio * 0.30
    };
  };

  const trabajosLeo = trabajos.filter(t => t.encargado === "Leo");
  const trabajosBruno = trabajos.filter(t => t.encargado === "Bruno");

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-800">
      <header className="mb-8 flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-slate-900">Estudio de Agrimensura</h1><p className="text-slate-500">Panel de Gestión Integral</p></div>
        <div className="flex gap-4">
          <button onClick={() => setActiveTab("trabajos")} className={`px-4 py-2 rounded-md font-semibold ${activeTab === "trabajos" ? "bg-slate-800 text-white" : "bg-white border text-slate-600"}`}>Expedientes en Curso</button>
          <button onClick={() => setActiveTab("finanzas")} className={`px-4 py-2 rounded-md font-semibold ${activeTab === "finanzas" ? "bg-slate-800 text-white" : "bg-white border text-slate-600"}`}>Finanzas (Semana Actual)</button>
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
                <tbody>
                  {trabajosLeo.map(t => (
                    <tr key={t.id} className="border-b"><td className="p-3 font-bold">{t.nombre_expediente}</td><td className={`p-3 text-sm font-medium ${t.color_alerta === 'verde' ? 'bg-[#c6f6d5]' : 'bg-[#fefcbf]'}`}>{t.estado_detalle}</td><td className="p-3"><button onClick={() => iniciarEdicionTrabajo(t)} className="text-xl hover:scale-110 transition-transform">✏️</button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-lg shadow border overflow-hidden">
              <div className="bg-[#ffe4e6] p-3 border-b border-slate-200"><h3 className="font-bold text-red-900 text-lg">Expedientes Bruno</h3></div>
              <table className="w-full text-left border-collapse">
                <thead><tr className="bg-slate-50 uppercase text-xs text-slate-500"><th className="p-3 border-b">Expediente</th><th className="p-3 border-b">Estado</th><th className="p-3 border-b w-16">Acción</th></tr></thead>
                <tbody>
                  {trabajosBruno.map(t => (
                    <tr key={t.id} className="border-b"><td className="p-3 font-bold">{t.nombre_expediente}</td><td className={`p-3 text-sm font-medium ${t.color_alerta === 'verde' ? 'bg-[#c6f6d5]' : 'bg-[#fefcbf]'}`}>{t.estado_detalle}</td><td className="p-3"><button onClick={() => iniciarEdicionTrabajo(t)} className="text-xl hover:scale-110 transition-transform">✏️</button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: FINANZAS */}
      {activeTab === "finanzas" && (
        <div className="space-y-6">
          <form onSubmit={guardarFinanza} className="bg-white p-4 rounded-lg shadow border grid grid-cols-4 gap-4 items-end">
            <div><label className="text-sm font-bold">Tipo</label><input required className="w-full border p-2 rounded" value={nuevaFinanza.tramite} onChange={e => actualizarValores('tramite', e.target.value)}/></div>
            <div><label className="text-sm font-bold">Propietario</label><input required className="w-full border p-2 rounded" value={nuevaFinanza.propietario} onChange={e => setNuevaFinanza({...nuevaFinanza, propietario: e.target.value})}/></div>
            <div><label className="text-sm font-bold">Entró por:</label><select className="w-full border p-2 rounded" value={nuevaFinanza.encargado} onChange={e => actualizarValores('encargado', e.target.value)}><option value="Leo">Leo</option><option value="Bruno">Bruno</option></select></div>
            <div><label className="text-sm font-bold">Ingreso Total ($)</label><input type="number" required className="w-full border p-2 rounded" value={nuevaFinanza.ingreso} onChange={e => setNuevaFinanza({...nuevaFinanza, ingreso: Number(e.target.value)})}/></div>
            
            <div><label className="text-sm font-bold">Caja ($)</label><input type="number" className="w-full border p-2 rounded" value={nuevaFinanza.caja} onChange={e => setNuevaFinanza({...nuevaFinanza, caja: Number(e.target.value)})}/></div>
            <div><label className="text-sm font-bold">Colegio ($)</label><input type="number" className="w-full border p-2 rounded" value={nuevaFinanza.colegio} onChange={e => setNuevaFinanza({...nuevaFinanza, colegio: Number(e.target.value)})}/></div>
            <div><label className="text-sm font-bold">Extra Leo ($)</label><input type="number" className="w-full border p-2 rounded" value={nuevaFinanza.extraLeo} onChange={e => setNuevaFinanza({...nuevaFinanza, extraLeo: Number(e.target.value)})}/></div>
            <div><label className="text-sm font-bold">Extra Bruno ($)</label><input type="number" className="w-full border p-2 rounded" value={nuevaFinanza.extraBruno} onChange={e => setNuevaFinanza({...nuevaFinanza, extraBruno: Number(e.target.value)})}/></div>
            
            <div className="col-span-4 flex justify-end gap-2 mt-2">
              {editandoFinanzaId && (
                <button type="button" onClick={() => {setEditandoFinanzaId(null); setNuevaFinanza({ tramite: "VEP", propietario: "", encargado: "Leo", ingreso: 0, caja: 83000, colegio: 69300, extraLeo: 20800, extraBruno: 0 });}} className="px-6 py-2 rounded font-bold text-slate-600 bg-slate-200 hover:bg-slate-300">Cancelar</button>
              )}
              <button type="submit" className={`px-6 py-2 rounded font-bold text-white ${editandoFinanzaId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {editandoFinanzaId ? "Guardar Edición" : "Cargar Ingreso"}
              </button>
            </div>
          </form>

          <div className="flex justify-end">
             <button onClick={liquidarSemana} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg">💰 Cerrar Semana (Liquidar)</button>
          </div>

          <div className="bg-white rounded-lg shadow border overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100 uppercase text-xs border-b">
                  <th className="p-4">Tipo</th><th className="p-4">Propietario</th><th className="p-4">Total</th><th className="p-4">Gastos</th><th className="p-4 text-blue-700">Limpio Leo</th><th className="p-4 text-red-700">Limpio Bruno</th><th className="p-4 w-16">Acción</th>
                </tr>
              </thead>
              <tbody>
                {finanzas.map((f) => {
                  const partes = calcularPartes(f);
                  return (
                    <tr key={f.id} className={`border-b ${f.encargado === 'Leo' ? 'bg-[#e0f2fe]' : 'bg-[#ffe4e6]'}`}>
                      <td className="p-4 font-bold">{f.tipo_tramite}</td><td className="p-4">{f.propietario}</td><td className="p-4 font-bold">${f.ingreso_total}</td>
                      <td className="p-4 text-slate-600">${partes.totalAportes}</td>
                      <td className="p-4 font-bold text-blue-800">${partes.limpioLeo}</td>
                      <td className="p-4 font-bold text-red-800">${partes.limpioBruno}</td>
                      <td className="p-4"><button onClick={() => iniciarEdicionFinanza(f)} className="text-xl hover:scale-110 transition-transform">✏️</button></td>
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
}