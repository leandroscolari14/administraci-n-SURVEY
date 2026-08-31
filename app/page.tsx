"use client";
import { useState } from "react";

export default function DashboardAgrimensura() {
  const [activeTab, setActiveTab] = useState("trabajos");

  // Mock de datos (luego esto vendrá de tu base de datos, por ejemplo Supabase)
  const trabajosEnCurso = [
    { id: 1, nombre: "PH DELTA", estado: "CORREGIDO PREVIA, ESPERANDO CFO PARA METER MUNI, FAC APROBADO", color: "verde" },
    { id: 2, nombre: "USUCAPIÓN PRENDES", estado: "DEFINIR, METIDAS NOTAS, APORTES PAGADOS", color: "amarillo" },
    { id: 3, nombre: "VEP PEREZ", estado: "FALTA COBRAR, ENTREGAMOS DESPUES", color: "verde_oscuro" },
  ];

  const finanzas = [
    { id: 1, tramite: "VEP", propietario: "BUGUEIRO", encargado: "Leo", ingreso: 930000, caja: 83000, colegio: 69300, extras: 80400 },
    { id: 2, tramite: "MS", propietario: "ALBERTENGO 2DO PAGO", encargado: "Bruno", ingreso: 2375000, caja: 0, colegio: 0, extras: 0 },
  ];

  // Función que automatiza la lógica matemática del excel de finanzas
  const calcularPartes = (finanza: any) => {
    const totalAportes = finanza.caja + finanza.colegio + finanza.extras;
    const limpio = finanza.ingreso - totalAportes;
    
    let limpioLeo = 0;
    let limpioBruno = 0;

    if (finanza.encargado === "Leo") {
      limpioLeo = limpio * 0.70;
      limpioBruno = limpio * 0.30;
    } else if (finanza.encargado === "Bruno") {
      limpioBruno = limpio * 0.80;
      limpioLeo = limpio * 0.20;
    }

    return { totalAportes, limpioLeo, limpioBruno };
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-800">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Estudio de Agrimensura</h1>
          <p className="text-slate-500">Panel de Gestión Integral</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab("trabajos")}
            className={`px-4 py-2 rounded-md font-semibold transition-colors ${activeTab === "trabajos" ? "bg-slate-800 text-white" : "bg-white border text-slate-600 hover:bg-slate-100"}`}
          >
            Expedientes en Curso
          </button>
          <button 
            onClick={() => setActiveTab("finanzas")}
            className={`px-4 py-2 rounded-md font-semibold transition-colors ${activeTab === "finanzas" ? "bg-slate-800 text-white" : "bg-white border text-slate-600 hover:bg-slate-100"}`}
          >
            Finanzas y Honorarios
          </button>
        </div>
      </header>

      {/* PESTAÑA: TRABAJOS EN CURSO */}
      {activeTab === "trabajos" && (
        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
                <th className="p-4 font-bold border-b">Nombre del Trabajo</th>
                <th className="p-4 font-bold border-b">Estado / Tareas Pendientes</th>
              </tr>
            </thead>
            <tbody>
              {trabajosEnCurso.map((trabajo) => (
                <tr key={trabajo.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-semibold">{trabajo.nombre}</td>
                  <td className={`p-4 font-medium text-sm
                    ${trabajo.color === 'verde' ? 'bg-[#c6f6d5] text-green-900' : ''}
                    ${trabajo.color === 'amarillo' ? 'bg-[#fefcbf] text-yellow-900' : ''}
                    ${trabajo.color === 'verde_oscuro' ? 'bg-[#9ae6b4] text-green-900' : ''}
                  `}>
                    {trabajo.estado}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PESTAÑA: FINANZAS */}
      {activeTab === "finanzas" && (
        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider border-b">
                <th className="p-4 font-bold">Tipo</th>
                <th className="p-4 font-bold">Propietario</th>
                <th className="p-4 font-bold">Ingreso Total</th>
                <th className="p-4 font-bold">Total Aportes</th>
                <th className="p-4 font-bold text-blue-700 bg-blue-50">Limpio Leo</th>
                <th className="p-4 font-bold text-red-700 bg-red-50">Limpio Bruno</th>
              </tr>
            </thead>
            <tbody>
              {finanzas.map((finanza) => {
                const { totalAportes, limpioLeo, limpioBruno } = calcularPartes(finanza);
                const isLeo = finanza.encargado === "Leo";
                
                return (
                  <tr key={finanza.id} className={`border-b last:border-0 transition-colors
                    ${isLeo ? 'bg-[#e0f2fe] hover:bg-[#bae6fd]' : 'bg-[#ffe4e6] hover:bg-[#fecdd3]'}
                  `}>
                    <td className="p-4 font-semibold">{finanza.tramite}</td>
                    <td className="p-4">{finanza.propietario}</td>
                    <td className="p-4 font-bold">${finanza.ingreso.toLocaleString('es-AR')}</td>
                    <td className="p-4 text-slate-600">${totalAportes.toLocaleString('es-AR')}</td>
                    <td className="p-4 font-bold text-blue-800">${limpioLeo.toLocaleString('es-AR')}</td>
                    <td className="p-4 font-bold text-red-800">${limpioBruno.toLocaleString('es-AR')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}