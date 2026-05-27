'use client';

import React, { useEffect, useState } from 'react';
import { useDiningStore } from '../store/diningStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Wifi } from 'lucide-react';
import getSocket from '../lib/socket';
import { guestId, guestName } from '../lib/useSocket';

interface Participant {
  socketId: string;
  guestId: string;
  guestName: string;
  joinedAt: string;
  tableNo: string;
}

// Deterministic color from a string
function avatarColor(id: string): string {
  const palette = [
    'bg-amber-500',
    'bg-purple-500',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-pink-500',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function TableGroupBanner() {
  const { sessionId, tableNo } = useDiningStore();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const socket = getSocket();

    socket.on('session:participants_updated', (data: {
      sessionId: string; participants: Participant[];
    }) => {
      if (data.sessionId === sessionId) {
        setParticipants(data.participants);
      }
    });

    socket.on('session:guest_left', (data: { guestId: string; guestName: string }) => {
      if (data.guestId === guestId) return;
      showToast(`${data.guestName} left the table`);
    });

    // Listen for remote cart actions to show toasts
    window.addEventListener('cart:remote_changed', handleRemoteCartChange);

    return () => {
      socket.off('session:participants_updated');
      socket.off('session:guest_left');
      window.removeEventListener('cart:remote_changed', handleRemoteCartChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function handleRemoteCartChange(e: Event) {
    const detail = (e as CustomEvent).detail;
    if (detail?.guestName && detail.guestName !== guestName) {
      if (detail.menuItemName) {
        showToast(`${detail.guestName} updated the shared cart`);
      } else {
        showToast(`${detail.guestName} changed the cart`);
      }
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  if (!sessionId || !tableNo) return null;

  const others = participants.filter((p) => p.guestId !== guestId);
  const total = participants.length;

  return (
    <>
      {/* Group banner */}
      <div
        className="w-full glassmorphism rounded-2xl border border-white/5 overflow-hidden cursor-pointer"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between px-4 py-3 gap-4">
          {/* Left: avatars + count */}
          <div className="flex items-center gap-3">
            {/* Live dot */}
            <div className="relative shrink-0">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-60" />
            </div>

            {/* Stacked avatar circles */}
            <div className="flex -space-x-2">
              {participants.slice(0, 5).map((p) => (
                <div
                  key={p.guestId}
                  title={p.guestId === guestId ? `${p.guestName} (You)` : p.guestName}
                  className={`w-7 h-7 ${avatarColor(p.guestId)} rounded-full border-2 border-neutral-900 flex items-center justify-center text-[9px] font-black text-white shrink-0 z-10`}
                >
                  {initials(p.guestName)}
                </div>
              ))}
              {total > 5 && (
                <div className="w-7 h-7 bg-neutral-700 rounded-full border-2 border-neutral-900 flex items-center justify-center text-[9px] font-bold text-neutral-300 shrink-0">
                  +{total - 5}
                </div>
              )}
            </div>

            {/* Text */}
            <div>
              <p className="text-xs font-bold text-white">
                {total === 1
                  ? 'Just you at this table'
                  : `${total} guests sharing Table #${tableNo}`}
              </p>
              <p className="text-[10px] text-neutral-400">
                {others.length > 0
                  ? `${others.map((p) => p.guestName.split(' ')[0]).slice(0, 3).join(', ')} ${others.length > 3 ? '& more' : ''} also here`
                  : 'Cart & orders are shared in real-time'}
              </p>
            </div>
          </div>

          {/* Right: badge */}
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shrink-0">
            <Wifi className="w-3 h-3" />
            <span>Live</span>
          </div>
        </div>

        {/* Expanded participant list */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="border-t border-white/5 px-4 py-3 space-y-2.5 overflow-hidden"
            >
              <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">
                Table Participants
              </p>
              {participants.map((p) => (
                <div key={p.guestId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 ${avatarColor(p.guestId)} rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0`}>
                      {initials(p.guestName)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {p.guestName}
                        {p.guestId === guestId && (
                          <span className="ml-1.5 text-[9px] text-amber-400 font-bold">(You)</span>
                        )}
                      </p>
                      <p className="text-[9px] text-neutral-500">
                        Joined {new Date(p.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast notification for remote cart changes */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -8, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-50 glassmorphism border border-white/10 px-4 py-2.5 rounded-full shadow-xl"
          >
            <p className="text-xs font-semibold text-white whitespace-nowrap flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse shrink-0" />
              {toast}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
