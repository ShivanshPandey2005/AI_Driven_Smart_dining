'use client';

import React, { useEffect, useState } from 'react';
import { useDiningStore, Order } from '../store/diningStore';
import { Clipboard, Flame, BellRing, Utensils, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import getSocket from '../lib/socket';

const STEPS = [
  { status: 'PENDING', label: 'Order Sent', desc: 'Awaiting kitchen approval', icon: Clipboard },
  { status: 'PREPARING', label: 'Preparing', desc: 'Chef is baking/simmering', icon: Flame },
  { status: 'READY', label: 'Ready', desc: 'Plated and ready to serve', icon: BellRing },
  { status: 'SERVED', label: 'Served', desc: 'Delicious food at your table', icon: Utensils },
];

export default function LiveOrderTracker() {
  const { sessionId, activeOrders, setActiveOrders } = useDiningStore();
  const [loading, setLoading] = useState(false);

  // Fetch active session orders on session change
  useEffect(() => {
    if (!sessionId) return;
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const list = await api.getOrders(sessionId);
        setActiveOrders(list);
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();

    // Setup Socket.io Listeners for real-time status changes
    const socket = getSocket();
    socket.emit('join_session', sessionId);

    socket.on('order_created', async (data: { orderId: string }) => {
      console.log('Real-time: New order created locally, refetching...');
      const list = await api.getOrders(sessionId);
      setActiveOrders(list);
    });

    socket.on('order_status_changed', (data: { orderId: string; status: any }) => {
      console.log(`Real-time: Order ${data.orderId} advanced to ${data.status}`);
      setActiveOrders(
        activeOrders.map((o) => (o.id === data.orderId ? { ...o, status: data.status } : o))
      );
      // Fetch latest from API to ensure perfect sync
      api.getOrders(sessionId).then((list) => setActiveOrders(list));
    });

    return () => {
      socket.off('order_created');
      socket.off('order_status_changed');
    };
  }, [sessionId, setActiveOrders, activeOrders.length]);

  // Find the first active, non-completed order (PENDING, PREPARING, or READY)
  const activeOrder = activeOrders.find(
    (o) => o.status === 'PENDING' || o.status === 'PREPARING' || o.status === 'READY'
  );

  if (!sessionId || !activeOrder) return null;

  const currentOrder = activeOrder;

  const getStepIndex = (status: string) => {
    return STEPS.findIndex((s) => s.status === status);
  };

  const currentIndex = getStepIndex(currentOrder.status);

  return (
    <div className="w-full glassmorphism rounded-2xl p-6 border border-white/10 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-white/5">
        <div>
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Active Order Status</span>
          <h3 className="text-base font-bold text-white mt-0.5 font-serif">Table Session Tracker</h3>
        </div>
        <div className="bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 text-xs font-bold text-amber-400">
          Order #{currentOrder.id.slice(-6).toUpperCase()}
        </div>
      </div>

      {/* Stepper Grid (Mobile Friendly column stack & Desktop row stepper) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
        {STEPS.map((step, idx) => {
          const StepIcon = step.icon;
          const isCompleted = idx < currentIndex || currentOrder.status === 'SERVED';
          const isActive = idx === currentIndex;
          const isUpcoming = idx > currentIndex && currentOrder.status !== 'SERVED';

          return (
            <div key={step.status} className="flex md:flex-col items-center md:text-center gap-4 md:gap-2.5 relative">
              {/* Connector line for desktop */}
              {idx < STEPS.length - 1 && (
                <div
                  className={`hidden md:block absolute top-[18px] left-[calc(50%+18px)] w-[calc(100%-36px)] h-0.5 z-0 ${
                    idx < currentIndex ? 'bg-amber-500' : 'bg-neutral-800'
                  }`}
                />
              )}

              {/* Step Circle Icon */}
              <motion.div
                animate={isActive ? { scale: [1, 1.1, 1], boxShadow: '0 0 15px rgba(234, 179, 8, 0.4)' } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
                className={`w-9 h-9 rounded-full flex items-center justify-center z-10 border transition ${
                  isCompleted
                    ? 'bg-amber-500 border-amber-500 text-black'
                    : isActive
                    ? 'bg-black border-amber-500 text-amber-500 pulse-glow-anim'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-600'
                }`}
              >
                <StepIcon className="w-4 h-4 shrink-0" />
              </motion.div>

              {/* Label & Description */}
              <div className="text-left md:text-center space-y-0.5">
                <p
                  className={`text-sm font-semibold transition ${
                    isCompleted || isActive ? 'text-white' : 'text-neutral-500'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-[11px] text-neutral-400 md:px-2 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dynamic active notice */}
      {currentOrder.status === 'PREPARING' && (
        <div className="bg-purple-950/20 p-3 rounded-xl border border-purple-500/10 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-purple-400 shrink-0" />
          <p className="text-xs text-purple-300">
            Our gourmet chefs are cooking up your order. Sit tight and enjoy the luxury ambience!
          </p>
        </div>
      )}
    </div>
  );
}
