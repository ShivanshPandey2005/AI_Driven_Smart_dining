'use client';

import React, { useEffect, useState } from 'react';
import { useDiningStore, MenuItem } from '../store/diningStore';
import { Search, Filter, ShoppingBag, Flame, Sparkles, Star, Heart, Check, ChevronRight, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import getSocket from '../lib/socket';
import RoleSwitcher from '../components/RoleSwitcher';
import CartDrawer from '../components/CartDrawer';
import LiveOrderTracker from '../components/LiveOrderTracker';
import AiCompanion from '../components/AiCompanion';
import KitchenDashboard from '../components/KitchenDashboard';

const CATEGORIES = ['All', 'Appetizers', 'Main Course', 'Breads & Rice', 'Desserts', 'Beverages'];

export default function Home() {
  const {
    sessionId,
    tableNo,
    setSession,
    role,
    cart,
    setCart,
    addToCartOptimistic,
    isCartOpen,
    setIsCartOpen,
  } = useDiningStore();

  // Component-level states
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  
  // Table join inputs
  const [tableInput, setTableInput] = useState('05');
  const [isJoining, setIsJoining] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeFilters, setActiveFilters] = useState<string[]>([]); // 'Veg', 'Non-Veg', 'Spicy', 'Bestseller', 'Light'

  // Fetch menu on load
  const loadMenu = async () => {
    setLoadingMenu(true);
    try {
      const data = await api.getMenu();
      setMenuItems(data);
    } catch (err) {
      console.error('Error loading menu:', err);
    } finally {
      setLoadingMenu(false);
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  // Sync cart when table session changes or socket notifies cart update
  const syncCart = async () => {
    if (!sessionId) return;
    try {
      const list = await api.getCart(sessionId);
      const mapped = list.map((item: any) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        menuItem: item.menuItem,
        quantity: item.quantity,
        notes: item.notes,
      }));
      setCart(mapped);
    } catch (err) {
      console.error('Error syncing cart:', err);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    syncCart();

    // Hook up socket triggers
    const socket = getSocket();
    socket.emit('join_session', sessionId);
    
    socket.on('cart_updated', () => {
      console.log('Real-time: Cart updated on another device, syncing...');
      syncCart();
    });

    return () => {
      socket.off('cart_updated');
    };
  }, [sessionId]);

  // Handle entering/joining a dining table session
  const handleJoinTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableInput.trim() || isJoining) return;
    setIsJoining(true);
    try {
      const session = await api.createSession(tableInput.trim());
      setSession(session.tableNo, session.id);
    } catch (err: any) {
      alert(`Could not start session: ${err.message}`);
    } finally {
      setIsJoining(false);
    }
  };

  const handleToggleFilter = (filter: string) => {
    if (activeFilters.includes(filter)) {
      setActiveFilters(activeFilters.filter((f) => f !== filter));
    } else {
      // Exclude opposite filters
      if (filter === 'Veg') {
        setActiveFilters([...activeFilters.filter((f) => f !== 'Non-Veg'), 'Veg']);
      } else if (filter === 'Non-Veg') {
        setActiveFilters([...activeFilters.filter((f) => f !== 'Veg'), 'Non-Veg']);
      } else {
        setActiveFilters([...activeFilters, filter]);
      }
    }
  };

  const handleAddToCart = async (item: MenuItem) => {
    if (!sessionId) return;
    // 1. Update optimistically in local Zustand store
    addToCartOptimistic(item);
    
    // 2. Open cart drawer immediately for visual feedback
    setIsCartOpen(true);

    try {
      // 3. Post to backend REST API
      await api.addToCart(sessionId, item.id, 1);
      
      // 4. Emit websocket cart updated notification to other table browsers
      const socket = getSocket();
      socket.emit('notify_cart_update', { sessionId });
    } catch (err) {
      console.error('Error adding to backend cart:', err);
    }
  };

  // Filter and search computation
  const filteredMenuItems = menuItems.filter((item) => {
    // Search query check
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    // Category tab check
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;

    // Filters checkbox check
    const matchesFilters = activeFilters.every((filter) => {
      if (filter === 'Veg') return item.tags.some((t) => t.toLowerCase() === 'vegetarian');
      if (filter === 'Non-Veg') return item.tags.some((t) => t.toLowerCase() === 'non-vegetarian');
      if (filter === 'Spicy') return item.tags.some((t) => t.toLowerCase() === 'spicy');
      if (filter === 'Bestseller') return item.tags.some((t) => t.toLowerCase() === 'best seller') || item.popularScore >= 90;
      if (filter === 'Light') {
        return (
          item.tags.some((t) => t.toLowerCase() === 'healthy' || t.toLowerCase() === 'refreshing') ||
          item.category === 'Beverages' ||
          !item.description.toLowerCase().includes('rich')
        );
      }
      return true;
    });

    return matchesSearch && matchesCategory && matchesFilters;
  });

  // Calculate cart counts
  const cartTotalQty = cart.reduce((acc, curr) => acc + curr.quantity, 0);

  // --- WELCOME LOADER PANEL (Rendered if guest is not yet checked into a table) ---
  if (!sessionId) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Glowing backdrop elements */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-md p-8 glassmorphism rounded-3xl border border-white/10 shadow-2xl relative space-y-8 text-center"
        >
          {/* Logo Brand */}
          <div className="space-y-2">
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg hover:rotate-6 transition duration-300">
              <Sparkles className="w-8 h-8 text-black" />
            </div>
            <h1 className="text-2xl font-bold font-serif gold-gradient-text tracking-tight pt-2">
              SMART DINING
            </h1>
            <p className="text-xs text-neutral-400 font-medium">Smart AI-Driven Restaurant Experience</p>
          </div>

          {/* Session Creation Form */}
          <form onSubmit={handleJoinTable} className="space-y-4">
            <div className="text-left space-y-1.5">
              <label htmlFor="table-no" className="text-xs font-bold text-neutral-300 uppercase tracking-wider pl-1">
                Enter Table Number
              </label>
              <input
                id="table-no"
                type="text"
                value={tableInput}
                onChange={(e) => setTableInput(e.target.value)}
                placeholder="e.g. 05"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white text-center font-bold text-lg placeholder-neutral-500 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/40 transition shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={isJoining}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-bold rounded-xl transition duration-300 shadow-lg hover:shadow-amber-500/10 active:scale-[0.98] disabled:opacity-50 text-sm flex items-center justify-center gap-1.5"
            >
              {isJoining ? 'Initializing Room...' : 'Enter Dining Room'}
              <ChevronRight className="w-4 h-4 text-black shrink-0" />
            </button>
          </form>

          {/* Luxury context statement */}
          <p className="text-[10px] text-neutral-500 leading-relaxed px-6">
            By entering the dining room, a live session will be synchronized with our smart servers and local kitchen screens.
          </p>
        </motion.div>
      </main>
    );
  }

  // --- MAIN LAYOUT (Customer Menu OR Kitchen Dashboard) ---
  return (
    <main className="min-h-screen bg-[#070707] text-white font-sans selection:bg-amber-500 selection:text-black">
      {/* Floating Demo utilities */}
      <RoleSwitcher />

      {/* Navigation Header */}
      <header className="sticky top-0 bg-neutral-950/80 backdrop-blur-md border-b border-white/5 z-30 px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center text-black font-bold">
            <Sparkles className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-serif tracking-wide gold-gradient-text uppercase">
              Smart Chef
            </h2>
            <span className="text-[10px] text-neutral-400 font-semibold block">Table Session #{tableNo}</span>
          </div>
        </div>

        {/* Dynamic header items (only for Customer role) */}
        {role === 'CUSTOMER' && (
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 transition group"
            title="Open basket"
          >
            <ShoppingBag className="w-4 h-4 text-neutral-300 group-hover:text-amber-400 transition" />
            {cartTotalQty > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center shadow-md animate-bounce">
                {cartTotalQty}
              </span>
            )}
          </button>
        )}
      </header>

      {/* Main content body grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {role === 'KITCHEN' || role === 'STAFF' || role === 'ADMIN' ? (
            <motion.div
              key="kitchen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <KitchenDashboard />
            </motion.div>
          ) : (
            // CUSTOMER VIEW / MENU SYSTEM
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Order Status Tracker */}
              <LiveOrderTracker />

              {/* Dynamic AI Pick recommendation Banner */}
              <div className="w-full bg-gradient-to-r from-purple-950/20 via-indigo-950/20 to-neutral-900/60 border border-purple-500/10 p-5 md:p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">AI Chef Recommendation</span>
                  </div>
                  <h3 className="text-lg font-bold font-serif text-white">"Suggest something spicy & rich, perfect with Garlic Naan?"</h3>
                  <p className="text-xs text-neutral-300 max-w-2xl leading-relaxed">
                    Our active culinary companion suggests pairing the fiery **Paneer Tikka Angare** with a sweet **Royal Mango Lassi** to compose a beautiful balance of heats. Ask the chat below!
                  </p>
                </div>
                <button
                  onClick={() => {
                    const el = document.querySelector('button.pulse-glow-anim') as HTMLButtonElement;
                    if (el) el.click();
                  }}
                  className="px-5 py-3 bg-purple-500 hover:bg-purple-600 text-black text-xs font-bold rounded-xl transition duration-300 shadow-md hover:shadow-purple-500/15 shrink-0"
                >
                  Consult Culinary Chatbot
                </button>
              </div>

              {/* Search and Filters Matrix */}
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  {/* Search input */}
                  <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search delicacies, ingredients..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-xs placeholder-neutral-500 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/40 transition"
                    />
                  </div>

                  {/* Filter pills */}
                  <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                    <Filter className="w-3.5 h-3.5 text-amber-400 mr-1.5 shrink-0" />
                    {['Veg', 'Non-Veg', 'Spicy', 'Bestseller', 'Light'].map((f) => {
                      const isActive = activeFilters.includes(f);
                      return (
                        <button
                          key={f}
                          onClick={() => handleToggleFilter(f)}
                          className={`px-3 py-1.5 rounded-full border text-[10px] font-bold transition shrink-0 uppercase tracking-wider flex items-center gap-1 ${
                            isActive
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                              : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {isActive && <Check className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                          {f}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Horizontal Category Tabs */}
                <div className="border-b border-white/5 pb-1 overflow-x-auto flex gap-6 scrollbar-none">
                  {CATEGORIES.map((cat) => {
                    const isActive = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`py-3 relative text-xs font-bold uppercase tracking-wider transition shrink-0 ${
                          isActive ? 'text-amber-400' : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {cat}
                        {isActive && (
                          <motion.div
                            layoutId="activeCategoryLine"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Menu Grid */}
              {loadingMenu ? (
                <div className="py-24 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                  <p className="text-xs text-neutral-400 font-medium">Baking tandoors, please wait...</p>
                </div>
              ) : filteredMenuItems.length === 0 ? (
                <div className="py-24 text-center glassmorphism rounded-2xl p-8 max-w-lg mx-auto border border-white/5 space-y-2">
                  <Search className="w-10 h-10 text-neutral-600 mx-auto" />
                  <p className="text-neutral-300 font-semibold text-sm">No culinary matches found</p>
                  <p className="text-neutral-500 text-xs px-6">Modify your custom filters or search term to discover available items.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredMenuItems.map((item) => {
                    const cartItem = cart.find((c) => c.menuItemId === item.id);
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-neutral-900/40 border border-white/5 hover:border-white/10 rounded-2xl overflow-hidden group shadow-lg flex flex-col justify-between transition-all duration-300 relative"
                      >
                        {/* Image & Badges */}
                        <div className="relative h-48 overflow-hidden bg-neutral-950 shrink-0">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                          
                          {/* Top Tag Badges */}
                          <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                            {item.tags.slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                  t === 'Spicy'
                                    ? 'bg-red-500/80 text-white'
                                    : t === 'Vegetarian'
                                    ? 'bg-emerald-500/80 text-black'
                                    : 'bg-black/60 text-amber-400'
                                }`}
                              >
                                {t}
                              </span>
                            ))}
                          </div>

                          {/* Popularity star rating */}
                          <div className="absolute bottom-3 right-3 bg-black/60 px-2 py-0.5 rounded border border-white/10 flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            <span className="text-[10px] text-white font-bold">{item.popularScore}%</span>
                          </div>
                        </div>

                        {/* Card Details */}
                        <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-baseline gap-2">
                              <h3 className="font-bold text-white text-sm font-serif group-hover:text-amber-400 transition">
                                {item.name}
                              </h3>
                              <span className="text-amber-400 font-bold text-sm shrink-0">
                                ₹{item.price}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2">
                              {item.description}
                            </p>
                          </div>

                          {/* Bottom Add button / Quantity controls */}
                          <div className="pt-2 flex items-center justify-between gap-3">
                            {/* Allergens warning */}
                            {item.allergens.length > 0 ? (
                              <span className="text-[9px] text-neutral-500 font-medium italic">
                                Contains: {item.allergens.join(', ')}
                              </span>
                            ) : (
                              <div />
                            )}

                            {cartItem ? (
                              <div className="flex items-center gap-2 bg-amber-500 text-black px-2.5 py-1 rounded-xl font-bold text-xs select-none">
                                <span>Added ({cartItem.quantity})</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAddToCart(item)}
                                className="px-3.5 py-2 bg-white/5 hover:bg-amber-500 rounded-xl text-neutral-300 hover:text-black text-xs font-bold border border-white/10 hover:border-amber-500 transition duration-300 flex items-center gap-1 group/btn active:scale-95"
                              >
                                Add to Order
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Elements (Only active for Customer) */}
      {role === 'CUSTOMER' && (
        <>
          <CartDrawer />
          <AiCompanion menuItems={menuItems} />
        </>
      )}
    </main>
  );
}
