'use client';

import React, { useEffect, useRef, useState } from 'react';
import { notifyGlobalSync } from '@/lib/events/offer-events';

const IDLE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes of no user activity
const SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes interval

export function SilentSyncProvider({ children }: { children: React.ReactNode }) {
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [isSyncing, setIsSyncing] = useState(false);
  const lastSyncTimeRef = useRef<number>(Date.now());

  // Throttled activity tracker
  useEffect(() => {
    let lastEventTime = 0;
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastEventTime > 5000) {
        // Throttle activity updates to once every 5 seconds
        lastEventTime = now;
        setLastActivity(now);
      }
    };

    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart', 'focus'];
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
    };
  }, []);

  // 10-minute Silent Background Sync Timer (Active when Idle or Periodic)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastSync = now - lastSyncTimeRef.current;
      const timeSinceLastActivity = now - lastActivity;

      // Execute silent sync if tab is visible AND (user is idle OR 10 minutes elapsed)
      if (
        document.visibilityState === 'visible' &&
        timeSinceLastSync >= SYNC_INTERVAL_MS &&
        timeSinceLastActivity >= IDLE_THRESHOLD_MS
      ) {
        console.log('[SILENT SYNC] 10-Minute Idle Background Sync Triggered (No page reload)');
        lastSyncTimeRef.current = now;
        setIsSyncing(true);
        notifyGlobalSync('10min_idle_background_sync');
        setTimeout(() => setIsSyncing(false), 1500);
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [lastActivity]);

  // Visibility / Tab Focus Sync
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const timeSinceLastSync = now - lastSyncTimeRef.current;
        // Refetch silently if tab was backgrounded for more than 5 minutes
        if (timeSinceLastSync > 5 * 60 * 1000) {
          console.log('[SILENT SYNC] Tab became visible - Executing Silent Refetch');
          lastSyncTimeRef.current = now;
          setIsSyncing(true);
          notifyGlobalSync('tab_focus_sync');
          setTimeout(() => setIsSyncing(false), 1500);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <>
      {children}
      {/* Discrete, non-intrusive indicator for silent background sync */}
      {isSyncing && (
        <div className="fixed bottom-4 right-4 z-50 px-3 py-1.5 rounded-full bg-slate-900/90 text-slate-300 border border-slate-700/80 text-[11px] font-medium shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Sincronizando dados...</span>
        </div>
      )}
    </>
  );
}
