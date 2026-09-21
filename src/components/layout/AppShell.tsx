'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';

import { SilentSyncProvider } from '@/components/providers/SilentSyncProvider';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SilentSyncProvider>
      <div className="min-h-screen flex bg-[#090D14] text-slate-100 antialiased selection:bg-blue-600/30 selection:text-blue-200">
        {/* Global Command Palette (⌘K) */}
        <CommandPalette />

        {/* Fixed Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </SilentSyncProvider>
  );
}
