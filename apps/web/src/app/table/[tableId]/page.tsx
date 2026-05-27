'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDiningStore } from '../../../store/diningStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle2, WifiOff, Clock, Users } from 'lucide-react';
import api from '../../../lib/api';
import getSocket from '../../../lib/socket';

type CheckInState = 'scanning' | 'success' | 'already_joined' | 'error';

function formatTtl(seconds: number): string {
  if (seconds < 0) return 'Expired';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

export default function TableCheckIn() {
  const params = useParams();
  const router = useRouter();
  const { sessionId: existingSessionId, setSession } = useDiningStore();

  const tableId = (typeof params.tableId === 'string' ? params.tableId : '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const [state, setState] = useState<CheckInState>('scanning');
  const [sessionInfo, setSessionInfo] = useState<{
    id: string; tableNo: string; participantCount: number;
    expiresAt: string; ttlSeconds: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!tableId) {
      setErrorMsg('Invalid QR code — no table number found.');
      setState('error');
      return;
    }

    // If the user already has this same session active — skip and redirect
    if (existingSessionId) {
      setState('already_joined');
      setTimeout(() => router.push('/'), 1200);
      return;
    }

    const doCheckIn = async () => {
      try {
        // Hit the new QR-first endpoint: GET /api/table/:tableNo/session
        const session = await api.joinTableSession(tableId);

        // Persist session data into Zustand (including TTL)
        setSession(session.tableNo, session.id, session.expiresAt, session.ttlSeconds);

        setSessionInfo({
          id: session.id,
          tableNo: session.tableNo,
          participantCount: session.participantCount ?? 1,
          expiresAt: session.expiresAt ?? '',
          ttlSeconds: session.ttlSeconds ?? 14400,
        });

        // Join Socket.io room for this session
        const socket = getSocket();
        socket.emit('join_session', session.id);

        setState('success');

        // Redirect after short success animation
        setTimeout(() => router.push('/'), 2200);
      } catch (err: any) {
        setErrorMsg(err.message || 'Check-in failed. Please rescan or contact staff.');
        setState('error');
      }
    };

    doCheckIn();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  return (
    <main className="min-h-screen bg-[#070707] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-amber-500/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />

      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-sm"
        >
          {/* ── SCANNING ──────────────────────────────────────────── */}
          {state === 'scanning' && (
            <div className="glassmorphism rounded-3xl border border-white/10 p-10 text-center space-y-6 shadow-2xl">
              {/* Pulsing ring animation */}
              <div className="relative mx-auto w-20 h-20">
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full bg-amber-500/20"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              </div>
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-widest font-bold mb-1">Verifying QR</p>
                <h2 className="text-xl font-bold text-white font-serif">
                  Table <span className="text-amber-400">#{tableId}</span>
                </h2>
                <p className="text-xs text-neutral-500 mt-2">Setting up your dining session…</p>
              </div>
            </div>
          )}

          {/* ── SUCCESS ───────────────────────────────────────────── */}
          {state === 'success' && sessionInfo && (
            <div className="glassmorphism rounded-3xl border border-emerald-500/20 p-8 text-center space-y-6 shadow-2xl">
              {/* Success mark */}
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                className="mx-auto w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-full flex items-center justify-center"
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </motion.div>

              <div>
                <p className="text-xs text-emerald-400 uppercase tracking-widest font-bold mb-1">Welcome!</p>
                <h2 className="text-2xl font-bold text-white font-serif">
                  Table <span className="gold-gradient-text">#{sessionInfo.tableNo}</span>
                </h2>
                <p className="text-xs text-neutral-400 mt-1">Your dining session is ready</p>
              </div>

              {/* Session info pills */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col items-center gap-1">
                  <Users className="w-4 h-4 text-amber-400" />
                  <p className="text-xs text-neutral-400 font-medium">Guests</p>
                  <p className="text-base font-bold text-white">{sessionInfo.participantCount}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col items-center gap-1">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <p className="text-xs text-neutral-400 font-medium">Session</p>
                  <p className="text-[11px] font-bold text-white">{formatTtl(sessionInfo.ttlSeconds)}</p>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-neutral-500">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Entering dining room…</span>
                </div>
                {/* Countdown bar */}
                <motion.div
                  className="mt-3 h-0.5 bg-amber-500 rounded-full"
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 2.1, ease: 'linear' }}
                />
              </div>
            </div>
          )}

          {/* ── ALREADY JOINED ─────────────────────────────────────── */}
          {state === 'already_joined' && (
            <div className="glassmorphism rounded-3xl border border-amber-500/20 p-8 text-center space-y-5 shadow-2xl">
              <div className="mx-auto w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white font-serif">Already Checked In</h2>
                <p className="text-xs text-neutral-400 mt-1">
                  You're already in an active session — redirecting to menu…
                </p>
              </div>
            </div>
          )}

          {/* ── ERROR ─────────────────────────────────────────────── */}
          {state === 'error' && (
            <div className="glassmorphism rounded-3xl border border-red-500/15 p-8 text-center space-y-5 shadow-2xl">
              <div className="mx-auto w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center">
                <WifiOff className="w-6 h-6 text-red-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-white font-serif">Check-in Failed</h2>
                <p className="text-xs text-red-400/90 leading-relaxed">{errorMsg}</p>
              </div>
              <button
                onClick={() => router.push('/')}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-white font-semibold transition"
              >
                Enter Table Number Manually →
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Branding footer */}
      <div className="mt-8 flex items-center gap-2 text-[10px] text-neutral-600 font-semibold tracking-widest uppercase">
        <Sparkles className="w-3 h-3 text-amber-700" />
        <span>Smart Dining</span>
      </div>
    </main>
  );
}
