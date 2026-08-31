export const dynamic = 'force-dynamic'; // Obliga a que siempre revise en vivo y no guarde en caché
import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const telegramBotToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || "";
const telegramChatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || "";

export async function GET() {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Buscamos el estado actual
    const { data } = await supabase.from("estado_catastro").select("*").limit(1);
    if (!data || data.length === 0) return NextResponse.json({ status: "Sin datos" });
    
    const catastro = data[0];
    
    // 2. Si alguien lo está usando, calculamos el tiempo
    if (catastro.usuario !== "Libre" && catastro.fecha_actualizacion) {
        const ahora = new Date().getTime();
        const inicio = new Date(catastro.fecha_actualizacion).getTime();
        const minutos = Math.floor((ahora - inicio) / (1000 * 60));
        
        // 3. Si pasaron 60 minutos o más, mandamos la alarma
        if (minutos >= 60) {
            const horas = Math.floor(minutos / 60);
            const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
            
            await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: telegramChatId,
                    text: `⚠️ *ALERTA: SCIT OLVIDADO*\n\nChe **${catastro.usuario}**, llevás más de ${horas} hora(s) con Catastro en uso. \n\n¿Te lo olvidaste abierto? Si ya no lo usás, acordate de entrar al panel a liberar el sistema.`,
                    parse_mode: "Markdown"
                })
            });
            
            return NextResponse.json({ status: "Alerta enviada", minutos });
        }
    }
    
    return NextResponse.json({ status: "Todo normal" });
}