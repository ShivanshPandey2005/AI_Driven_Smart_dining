'use client';

import React, { useEffect, useState } from 'react';
import { useDiningStore } from '../store/diningStore';
import { Clock, AlertCircle } from 'lucide-react';

export default function SessionTtlBadge() {
  const { sessionExpiresAt, tableNo, clearSession } = useDiningStore();
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!sessionExpiresAt) return;

    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(sessionExpiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        // Session expired — clear local state
        clearSession();
      }
    };

    tick();
    const interval = setInterval(tick, 10_000); // update every 10s
    return () => clearInterval(interval);
  }, [sessionExpiresAt, clearSession]);

  if (!sessionExpiresAt || !tableNo) return null;

  const hours = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const isWarning = secondsLeft < 600; // <10 min → amber warning
  const isCritical = secondsLeft < 120; // <2 min → red

  const label =
    secondsLeft === 0
      ? 'Expired'
      : hours > 0
      ? `${hours}h ${mins}m left`
      : `${mins}m left`;

  return (
    <div
      className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold transition ${
        isCritical
          ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse'
          : isWarning
          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          : 'bg-white/5 border-white/10 text-neutral-400'
      }`}
      title="Session expires and cart will be cleared after 4 hours"
    >
      {isCritical ? (
        <AlertCircle className="w-3 h-3 shrink-0" />
      ) : (
        <Clock className="w-3 h-3 shrink-0" />
      )}
      <span>{label}</span>
    </div>
  );
}
