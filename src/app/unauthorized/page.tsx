'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

export default function UnauthorizedPage() {
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-[#090D14] flex flex-col justify-center items-center p-4 text-slate-100">
      <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-white mb-2">
            Acesso Não Autorizado
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Sua conta está autenticada, porém não possui permissão de acesso a este sistema privado.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Encerrar Sessão e Trocar de Conta</span>
          </button>
          <Link
            href="/login"
            className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-medium transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Início</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
