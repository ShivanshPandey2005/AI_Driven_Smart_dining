'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDiningStore, MenuItem } from '../../store/diningStore';
import { 
  Grid3X3, Sparkles, TrendingUp, Cpu, ToggleLeft, ToggleRight, 
  BarChart3, RefreshCw, Layers, ShieldAlert, Languages, Check, ArrowRight, X
} from 'lucide-react';
import api from '../../lib/api';

export default function AdminDashboard() {
  const { role, setRole } = useDiningStore();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Sync menu items
  const fetchMenu = async () => {
    setLoading(true);
    try {
      const data = await api.getMenu();
      setMenuItems(data);
    } catch (err) {
      console.error('Error fetching admin menu:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  // Toggle availability handler
  const handleToggleAvailable = async (itemId: string, currentVal: boolean) => {
    setUpdatingId(itemId);
    try {
      // Mock toggling availability since it's an elegant demo toggle
      setMenuItems(prev => 
        prev.map(item => item.id === itemId ? { ...item, available: !currentVal } : item)
      );
      // Wait a tiny moment to show nice state
      await new Promise(r => setTimeout(r, 450));
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  // Group items by category
  const categories = Array.from(new Set(menuItems.map(item => item.category)));

  // Bestsellers list
  const bestSellers = [...menuItems]
    .sort((a, b) => b.popularScore - a.popularScore)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-10 space-y-10">
      
      {/* Admin Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400">
            <BarChart3 className="w-6 h-6 shrink-0" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-extrabold gold-gradient-text">Management & Analytics Dashboard</h1>
            <p className="text-xs text-neutral-400">Monitor kitchen items, popularity vectors, and AI agent performance live</p>
          </div>
        </div>

        {/* Dashboard Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={fetchMenu}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition active:scale-95 flex items-center gap-1.5 text-xs font-bold text-neutral-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Sync Data
          </button>
          
          <button
            onClick={() => window.location.href = '/admin/qr'}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-extrabold rounded-xl text-xs transition duration-300 active:scale-95 flex items-center gap-1"
          >
            QR Code Panel <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid 1: Analytics Counters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Metric 1 */}
        <div className="glassmorphism p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex justify-between items-center text-neutral-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total AI Prompts Assisted</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">428</p>
          <span className="text-[10px] text-emerald-400 font-bold">↑ 24% since yesterday</span>
        </div>

        {/* Metric 2 */}
        <div className="glassmorphism p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex justify-between items-center text-neutral-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Deflected Exploits</span>
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">12</p>
          <span className="text-[10px] text-neutral-500 font-semibold">Prompt injection blocked</span>
        </div>

        {/* Metric 3 */}
        <div className="glassmorphism p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex justify-between items-center text-neutral-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Avg Response Latency</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">1.12s</p>
          <span className="text-[10px] text-emerald-400 font-bold">Optimized for production</span>
        </div>

        {/* Metric 4 */}
        <div className="glassmorphism p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex justify-between items-center text-neutral-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Language Distribution</span>
            <Languages className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-base font-extrabold text-white">Hinglish / Telugu-Eng</p>
          <span className="text-[10px] text-neutral-400 font-semibold">52% queries normalized</span>
        </div>
      </div>

      {/* Grid 2: Bestsellers & AI Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Column 1 & 2: Menu Items Manager */}
        <div className="lg:col-span-2 space-y-5">
          <h2 className="text-lg font-bold font-serif text-white flex items-center gap-2">
            <Grid3X3 className="w-4 h-4 text-amber-500" /> Kitchen Catalog & Availability
          </h2>

          <div className="glassmorphism rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-neutral-500 text-xs">Loading admin menu items...</div>
            ) : menuItems.length === 0 ? (
              <div className="p-12 text-center text-neutral-500 text-xs">No catalog items found.</div>
            ) : (
              menuItems.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between gap-4 hover:bg-white/5 transition duration-300">
                  <div className="flex items-center gap-3">
                    <img 
                      src={item.imageUrl} 
                      alt={item.name} 
                      className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0" 
                    />
                    <div className="text-left">
                      <h4 className="text-xs md:text-sm font-bold text-white">{item.name}</h4>
                      <span className="text-[10px] text-amber-500 font-semibold">₹{item.price} | {item.category}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Item Availability Toggle */}
                    <button
                      onClick={() => handleToggleAvailable(item.id, item.available)}
                      disabled={updatingId === item.id}
                      className="transition duration-300 active:scale-95 disabled:opacity-40"
                    >
                      {item.available ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                          <Check className="w-3.5 h-3.5" /> In Stock
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-red-400 font-bold bg-red-500/10 px-2.5 py-1 rounded-xl border border-red-500/20">
                          <X className="w-3.5 h-3.5" /> Out of Stock
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: AI Popularity Scoring & Agent Logs */}
        <div className="space-y-6">
          <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" /> Bestseller Analytics
          </h2>

          <div className="glassmorphism p-5 rounded-2xl border border-white/5 space-y-5">
            <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">Real-time Guest Popularity Scores</span>
            
            <div className="space-y-4">
              {bestSellers.map((item) => (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-neutral-300 truncate max-w-[160px]">{item.name}</span>
                    <span className="text-amber-400 font-extrabold">{item.popularScore}% score</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${item.popularScore}%` }}
                      transition={{ duration: 1 }}
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full" 
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* AI Diagnostics details */}
            <div className="border-t border-white/5 pt-4 space-y-3.5">
              <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">AI Orchestration Agent Logs</span>
              
              <div className="text-[10px] space-y-2 font-mono text-neutral-400 text-left bg-black/40 p-3 rounded-xl border border-white/5 leading-relaxed">
                <div>[INFO] NLU translation triggered for Table 12.</div>
                <div>[INFO] Extracted preference: vegetarian, dairy-allergy.</div>
                <div>[WARN] Prompt injection match deflected at 03:14:02.</div>
                <div>[INFO] Waiter alert raised: table 4 frustration flag true.</div>
                <div className="text-amber-500 font-bold">[READY] All 8 active agents synchronized.</div>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
