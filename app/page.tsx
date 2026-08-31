"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Conexión a tu base de datos
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function DashboardAgrimensura() {
  const [activeTab, setActiveTab] = useState("trabajos");
  const [trabajos, setTrabajos] = useState<any[]>([]);
  const [finanzas, setFinanzas] = useState<any[]>([]);

  // Estados para los formularios
  const [nuevoTrabajo, setNuevoTrabajo] = useState({ nombre: "", estado: "", color: "verde" });
  const [nuevaFinanza, setNuevaFinanza] = useState({ tramite: "VEP", propietario: "", encargado: "Leo", ingreso: 0, caja: 0, colegio: 0, extras: 0 });

  // Cargar datos al abrir la página
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const { data: dataTrabajos } = await supabase.from("trabajos_curso").select("*").order("fecha_actualizacion", { ascending: false });
    const { data: dataFinanzas } = await supabase.from("finanzas").select("*").eq("liquidado", false).order("fecha_carga", { ascending: false });
    
    if (dataTrabajos) setTrabajos(dataTrabajos);
    if (dataFinanzas) setFinanzas(dataFinanzas);
  };

  // Funciones para agregar datos
  const agregarTrabajo = async (e: any) => {
    e.preventDefault();
    await supabase.from("trabajos_curso").insert([{
      nombre_expediente: nuevoTrabajo.nombre,
      estado_detalle: nuevoTrabajo.estado,
      color_alerta: nuevoTrabajo.color
    }]);
    setNuevoTrabajo({ nombre: "", estado: "", color: "verde" });
    cargarDatos();
  };

  const agregarFinanza = async (e: any) => {
    e.preventDefault();
    await supabase.from("finanzas").insert([{
      tipo_tramite: nuevaFinanza.tramite,
      propietario: nuevaFinanza.propietario,
      encargado: nuevaFinanza.encargado,
      ingreso_total: nuevaFinanza.ingreso,
      caja: nuevaFinanza.caja,
      colegio: nuevaFinanza.colegio,
      extras: nuevaFinanza.extras
    }]);
    setNuevaFinanza({ tramite: "VEP", propietario: "", encargado: "Leo", ingreso: 0, caja: 0, colegio: 0, extras: 0 });
    cargarDatos();
  };

  // Botón mágico para cerrar la semana
  const liquidarSemana = async () => {
    if (confirm("¿Estás seguro de liquidar y cerrar esta semana? Los trabajos pasarán al historial.")) {
      const ids = finanzas.map(f => f.id);
      await supabase.from("finanzas").update({ liquidado: true }).in("id", ids);
      cargarDatos();
      alert("¡Semana liquidada con éxito! Cuenta en 0.");
    }
  };

  const calcularPartes = (f: any) => {
    const totalAportes = Number(f.caja) + Number(f.colegio) + Number(f.extras);
    const limpio = Number(f.ingreso_total) - totalAportes;
    return {
      totalAportes,
      limpioLeo: f.encargado === "Leo" ? limpio * 0.70 : limpio * 0.20,
      limpioBruno: f.encargado === "Bruno" ? limpio * 0.80 : limpio * 0.30
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-800">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Estudio de Agrimensura</h1>
          <p className="text-slate-500">Panel de Gestión Integral</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setActiveTab("trabajos")} className={`px-4 py-2 rounded-md font-semibold ${activeTab === "trabajos" ? "bg-slate-800 text-white" : "bg-white border text-slate-600"}`}>Expedientes en Curso</button>
          <button onClick={() => setActiveTab("finanzas")} className={`px-4 py-2 rounded-md font-semibold ${activeTab === "finanzas" ? "bg-slate-800 text-white" : "bg-white border text-slate-600"}`}>Finanzas (Semana Actual)</button>
        </div>
      </header>

      {/* PESTAÑA: TRABAJOS EN CURSO */}
      {activeTab === "trabajos" && (
        <div className="space-y-6">
          <form onSubmit={agregarTrabajo} className="bg-white p-4 rounded-lg shadow border flex gap-4 items-end">
            <div className="flex-1"><label className="text-sm font-bold">Expediente</label><input required className="w-full border p-2 rounded" value={nuevoTrabajo.nombre} onChange={e => setNuevoTrabajo({...nuevoTrabajo, nombre: e.target.value})} placeholder="Ej: PH DELTA"/></div>
            <div className="flex-2"><label className="text-sm font-bold">Estado</label><input required className="w-full border p-2 rounded" value={nuevoTrabajo.estado} onChange={e => setNuevoTrabajo({...nuevoTrabajo, estado: e.target.value})} placeholder="Ej: Esperando Muni"/></div>
            <div><label className="text-sm font-bold">Alerta</label><select className="w-full border p-2 rounded" value={nuevoTrabajo.color} onChange={e => setNuevoTrabajo({...nuevoTrabajo, color: e.target.value})}><option value="verde">Verde (Ingresado)</option><option value="amarillo">Amarillo (Pendiente)</option></select></div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-bold">Agregar</button>
          </form>

          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-100 uppercase text-xs"><th className="p-4 border-b">Expediente</th><th className="p-4 border-b">Estado</th></tr></thead>
              <tbody>
                {trabajos.map((t) => (
                  <tr key={t.id} className="border-b"><td className="p-4 font-bold">{t.nombre_expediente}</td><td className={`p-4 font-medium ${t.color_alerta === 'verde' ? 'bg-[#c6f6d5]' : 'bg-[#fefcbf]'}`}>{t.estado_detalle}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA: FINANZAS */}
      {activeTab === "finanzas" && (
        <div className="space-y-6">
          <form onSubmit={agregarFinanza} className="bg-white p-4 rounded-lg shadow border grid grid-cols-4 gap-4 items-end">
            <div><label className="text-sm font-bold">Tipo</label><input required className="w-full border p-2 rounded" value={nuevaFinanza.tramite} onChange={e => setNuevaFinanza({...nuevaFinanza, tramite: e.target.value})}/></div>
            <div><label className="text-sm font-bold">Propietario</label><input required className="w-full border p-2 rounded" value={nuevaFinanza.propietario} onChange={e => setNuevaFinanza({...nuevaFinanza, propietario: e.target.value})}/></div>
            <div><label className="text-sm font-bold">Entró por:</label><select className="w-full border p-2 rounded" value={nuevaFinanza.encargado} onChange={e => setNuevaFinanza({...nuevaFinanza, encargado: e.target.value})}><option>Leo</option><option>Bruno</option></select></div>
            <div><label className="text-sm font-bold">Ingreso Total ($)</label><input type="number" required className="w-full border p-2 rounded" value={nuevaFinanza.ingreso} onChange={e => setNuevaFinanza({...nuevaFinanza, ingreso: Number(e.target.value)})}/></div>
            <div><label className="text-sm font-bold">Caja ($)</label><input type="number" className="w-full border p-2 rounded" value={nuevaFinanza.caja} onChange={e => setNuevaFinanza({...nuevaFinanza, caja: Number(e.target.value)})}/></div>
            <div><label className="text-sm font-bold">Colegio ($)</label><input type="number" className="w-full border p-2 rounded" value={nuevaFinanza.colegio} onChange={e => setNuevaFinanza({...nuevaFinanza, colegio: Number(e.target.value)})}/></div>
            <div><label className="text-sm font-bold">Extras ($)</label><input type="number" className="w-full border p-2 rounded" value={nuevaFinanza.extras} onChange={e => setNuevaFinanza({...nuevaFinanza, extras: Number(e.target.value)})}/></div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-bold">Cargar Ingreso</button>
          </form>

          <div className="flex justify-end">
             <button onClick={liquidarSemana} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg">💰 Cerrar Semana (Liquidar)</button>
          </div>

          <div className="bg-white rounded-lg shadow border overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100 uppercase text-xs border-b">
                  <th className="p-4">Tipo</th><th className="p-4">Propietario</th><th className="p-4">Total</th><th className="p-4">Gastos</th><th className="p-4 text-blue-700">Limpio Leo</th><th className="p-4 text-red-700">Limpio Bruno</th>
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