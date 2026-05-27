'use client';

import React, { useEffect, useState } from 'react';
import { useDiningStore, Order } from '../store/diningStore';
import { ChefHat, Flame, BellRing, Utensils, CheckCircle, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import getSocket from '../lib/socket';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAllOrders = async () => {
    try {
      const all = await api.getAllOrders();
      setOrders(all);
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAllOrders().finally(() => setLoading(false));

    // Socket.io listeners to sync new orders live
    const socket = getSocket();
    socket.emit('join_kitchen');

    socket.on('new_order_received', (data) => {
      console.log('Kitchen: Received new live order notification!', data);
      fetchAllOrders();
    });

    socket.on('order_status_synchronized', () => {
      fetchAllOrders();
    });

    return () => {
      socket.off('new_order_received');
      socket.off('order_status_synchronized');
    };
  }, []);

  const handleUpdateStatus = async (order: Order, newStatus: string) => {
    try {
      // 1. Advance status via API
      await api.updateOrderStatus(order.id, newStatus);
      
      // 2. Broadcast status update to consumer tables via socket
      const socket = getSocket();
      socket.emit('notify_order_status_update', {
        sessionId: order.sessionId,
        orderId: order.id,
        status: newStatus,
      });

      // Refetch
      fetchAllOrders();
    } catch (err: any) {
      alert(`Error advancing status: ${err.message}`);
    }
  };

  // Group orders for beautiful visualization
  const activeOrders = orders.filter((o) => ['PENDING', 'PREPARING', 'READY'].includes(o.status));
  const completedOrders = orders.filter((o) => ['SERVED', 'CANCELLED'].includes(o.status)).slice(0, 8);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'PREPARING':
        return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      case 'READY':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'SERVED':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      default:
        return 'bg-neutral-800 text-neutral-400';
    }
  };

  return (
    <div className="w-full space-y-8 pb-12">
      {/* Page Title */}
      <div className="flex items-center justify-between pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-purple-400">
            <ChefHat className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-serif gold-gradient-text">Kitchen Command Center</h1>
            <p className="text-xs text-neutral-400">Manage, prep, and serve active table orders in real-time</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold text-neutral-400">Total Active Orders</span>
          <p className="text-xl font-bold text-amber-400">{activeOrders.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Cooking Board: Pending & Preparing (Columns 1 & 2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white font-serif flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" /> Active Prep Queues
            </h2>
            <span className="text-[10px] bg-red-500/20 border border-red-500/30 px-2 py-0.5 rounded text-red-400 font-bold animate-pulse">Live</span>
          </div>

          {activeOrders.length === 0 ? (
            <div className="glassmorphism rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
              <CheckCircle className="w-12 h-12 text-emerald-500/40" />
              <p className="text-neutral-300 font-semibold text-sm">All tables are served!</p>
              <p className="text-neutral-500 text-xs px-12">Awaiting new guest orders. Sit back or prepare fresh spices.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {activeOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glassmorphism p-5 rounded-2xl border border-white/5 space-y-4 flex flex-col justify-between"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${getStatusBadge(order.status)}`}>
                          {order.status}
                        </span>
                        {/* Table tag */}
                        <h3 className="text-base font-bold text-white mt-2 font-serif">Table Session</h3>
                      </div>
                      <span className="text-xs text-neutral-400 font-bold">
                        #{order.id.slice(-6).toUpperCase()}
                      </span>
                    </div>

                    {/* Order Items List */}
                    <div className="border-t border-b border-white/5 py-3 space-y-2.5 flex-1">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-xs items-start">
                          <span className="text-neutral-300 leading-relaxed">
                            <strong className="text-white text-sm pr-1">{item.quantity}x</strong> {item.menuItem?.name || 'Dish'}
                          </span>
                          {item.notes && (
                            <span className="text-[10px] bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 italic text-amber-300 max-w-[120px] truncate" title={item.notes}>
                              "{item.notes}"
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Status Action Buttons */}
                    <div className="pt-2">
                      {order.status === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateStatus(order, 'PREPARING')}
                          className="w-full py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-bold rounded-lg transition"
                        >
                          Accept & Start Prep
                        </button>
                      )}
                      {order.status === 'PREPARING' && (
                        <button
                          onClick={() => handleUpdateStatus(order, 'READY')}
                          className="w-full py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5"
                        >
                          <BellRing className="w-3.5 h-3.5" /> Mark Ready to Serve
                        </button>
                      )}
                      {order.status === 'READY' && (
                        <button
                          onClick={() => handleUpdateStatus(order, 'SERVED')}
                          className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-black text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5"
                        >
                          <Utensils className="w-3.5 h-3.5 text-black" /> Mark Served at Table
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* History / Completed Board (Column 3) */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white font-serif flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" /> Completed Orders
          </h2>

          <div className="glassmorphism p-5 rounded-2xl border border-white/5 space-y-4 max-h-[550px] overflow-y-auto">
            {completedOrders.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-6">No served history yet.</p>
            ) : (
              completedOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-3 bg-neutral-900/40 rounded-xl border border-white/5 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">Order #{order.id.slice(-4).toUpperCase()}</span>
                      <span className="text-[10px] text-emerald-400 font-bold uppercase">Served</span>
                    </div>
                    <p className="text-neutral-500 text-[10px] mt-0.5">Total Amount: ₹{order.totalAmount}</p>
                  </div>
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
