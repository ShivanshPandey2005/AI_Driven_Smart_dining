'use client';

import React, { useState, useEffect } from 'react';
import { useDiningStore } from '../store/diningStore';
import { X, Trash2, Plus, Minus, ShoppingBag, Users, Check, ShieldAlert, Phone, User, Key, Lock, ArrowLeft, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import { useSocket, guestId, guestName } from '../lib/useSocket';

const LABEL_COLORS = [
  'bg-amber-500/15 text-amber-300 border-amber-500/20',
  'bg-purple-500/15 text-purple-300 border-purple-500/20',
  'bg-blue-500/15 text-blue-300 border-blue-500/20',
  'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  'bg-rose-500/15 text-rose-300 border-rose-500/20',
  'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
];

const ownerColorMap = new Map<string, number>();
let colorCounter = 0;
function ownerColor(ownerId: string): string {
  if (!ownerColorMap.has(ownerId)) {
    ownerColorMap.set(ownerId, colorCounter++ % LABEL_COLORS.length);
  }
  return LABEL_COLORS[ownerColorMap.get(ownerId)!];
}

export default function CartDrawer() {
  const {
    isCartOpen, setIsCartOpen,
    cart, setCart,
    updateQuantityOptimistic,
    removeFromCartOptimistic,
    clearCartOptimistic,
    sessionId, tableNo,
    addOrder,
  } = useDiningStore();

  const socket = useSocket();
  
  // Checkout States
  const [isCheckoutMode, setIsCheckoutMode] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'DETAILS' | 'OTP' | 'SUCCESS'>('DETAILS');
  const [name, setName] = useState(guestName || '');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [successOrderInfo, setSuccessOrderInfo] = useState<{ id: string; waitTime: number } | null>(null);

  // Reset steps on close/open
  useEffect(() => {
    if (!isCartOpen) {
      setIsCheckoutMode(false);
      setCheckoutStep('DETAILS');
      setOtp('');
      setOtpError('');
    }
  }, [isCartOpen]);

  // Re-sync cart on remote events
  useEffect(() => {
    const handleRemoteChange = async () => {
      if (!sessionId) return;
      try {
        const list = await api.getCart(sessionId);
        setCart(list.map((i: any) => ({
          id: i.id,
          menuItemId: i.menuItemId,
          menuItem: i.menuItem,
          quantity: i.quantity,
          notes: i.notes,
          ownerId: i.ownerId,
          ownerName: i.ownerName,
        })));
      } catch {/* silent */}
    };

    window.addEventListener('cart:remote_changed', handleRemoteChange);
    return () => window.removeEventListener('cart:remote_changed', handleRemoteChange);
  }, [sessionId, setCart]);

  const subtotal = cart.reduce((acc, c) => acc + c.quantity * c.menuItem.price, 0);
  const gst = Math.round(subtotal * 0.05);
  const totalAmount = subtotal + gst;

  // Quantity controllers
  const handleUpdateQuantity = async (
    menuItemId: string, menuItemName: string, change: number, cartItemId?: string
  ) => {
    updateQuantityOptimistic(menuItemId, change);
    if (cartItemId) {
      const item = cart.find((c) => c.menuItemId === menuItemId);
      if (!item) return;
      const newQty = item.quantity + change;
      if (newQty <= 0) {
        await api.deleteCartItem(cartItemId);
        socket.emitCartItemRemoved(menuItemId, menuItemName);
      } else {
        await api.updateCartItem(cartItemId, newQty);
        socket.emitCartItemUpdated(menuItemId, menuItemName, newQty);
      }
    }
  };

  const handleRemoveItem = async (
    menuItemId: string, menuItemName: string, cartItemId?: string
  ) => {
    removeFromCartOptimistic(menuItemId);
    if (cartItemId) {
      await api.deleteCartItem(cartItemId);
    }
    socket.emitCartItemRemoved(menuItemId, menuItemName);
  };

  // Trigger SMS Verification Code (Simulated)
  const handleSendOtp = () => {
    if (!name.trim() || !phone.trim()) return;
    setCheckoutStep('OTP');
  };

  // Final Order placement check
  const handleVerifyAndCheckout = async () => {
    if (otp !== '123456') {
      setOtpError('Invalid secure verification code. Please try again!');
      return;
    }

    if (!sessionId || cart.length === 0) return;
    setOtpError('');
    setIsPlacingOrder(true);

    try {
      // ─── OPTIMISTIC UI UPDATE ───
      // Instantly clear cart locally to make checkout feel high speed!
      const originalCart = [...cart];
      clearCartOptimistic();
      setCheckoutStep('SUCCESS');

      // Place order via API
      const newOrder = await api.placeOrder(sessionId);
      addOrder(newOrder);

      // Estimated wait time logic (e.g. 15-25 minutes based on items count)
      const estimatedWaitTime = Math.max(15, Math.min(45, 15 + originalCart.length * 3));
      setSuccessOrderInfo({ id: newOrder.id.slice(-6).toUpperCase(), waitTime: estimatedWaitTime });

      // Broadcast order event
      socket.emitOrderPlaced(
        newOrder.id,
        tableNo || '01',
        totalAmount,
        originalCart.length
      );
    } catch (err: any) {
      setOtpError(`Server transaction failed: ${err.message}`);
      setIsPlacingOrder(false);
    }
  };

  const hasMultipleOwners = cart.some(
    (c) => (c as any).ownerName && (c as any).ownerName !== guestName
  );

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (checkoutStep !== 'SUCCESS') setIsCartOpen(false);
            }}
            className="fixed inset-0 bg-black/85 z-40 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-full max-w-md glassmorphism z-50 shadow-2xl flex flex-col border-l border-white/10"
          >
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {isCheckoutMode && checkoutStep !== 'SUCCESS' && (
                  <button 
                    onClick={() => {
                      if (checkoutStep === 'OTP') setCheckoutStep('DETAILS');
                      else setIsCheckoutMode(false);
                    }}
                    className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 mr-1.5 transition"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <div>
                  <h2 className="text-base font-bold font-serif gold-gradient-text">
                    {isCheckoutMode ? 'Secure Checkout' : `Shared Order — Table ${tableNo}`}
                  </h2>
                  {!isCheckoutMode && hasMultipleOwners && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Users className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] text-purple-300 font-semibold">Group Basket — active multi-users</span>
                    </div>
                  )}
                </div>
              </div>
              
              {checkoutStep !== 'SUCCESS' && (
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Main Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* SUCCESS STEP */}
              {checkoutStep === 'SUCCESS' ? (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center p-4 space-y-6"
                >
                  <div className="w-20 h-20 bg-emerald-500/10 border-4 border-emerald-500 rounded-full flex items-center justify-center text-emerald-400 relative">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.15, type: 'spring' }}
                    >
                      <Check className="w-10 h-10" />
                    </motion.div>
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-extrabold text-white font-serif">Order Confirmed!</h3>
                    <p className="text-xs text-neutral-400 max-w-xs leading-relaxed mx-auto">
                      Verification complete. Your dining session tickets are officially in the kitchen queue!
                    </p>
                  </div>

                  <div className="w-full bg-neutral-900/80 border border-white/5 p-4 rounded-2xl space-y-3.5">
                    <div className="flex justify-between text-xs border-b border-white/5 pb-2">
                      <span className="text-neutral-400">Order Token</span>
                      <span className="font-bold text-amber-400">#{successOrderInfo?.id || 'ZARA-X'}</span>
                    </div>

                    <div className="space-y-1.5 text-left">
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-400 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500" /> Est. Preparation Wait</span>
                        <span className="font-extrabold text-white">{successOrderInfo?.waitTime || 20} minutes</span>
                      </div>
                      
                      {/* Preparation Wait progress bar */}
                      <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '45%' }}
                          transition={{ duration: 1.5 }}
                          className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full" 
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-6 py-2.5 bg-white text-black font-extrabold rounded-xl transition hover:bg-neutral-200 active:scale-95 text-xs"
                  >
                    View Preparation Stepper
                  </button>
                </motion.div>
              ) : isCheckoutMode ? (
                /* CHECKOUT SECURE FORMS */
                <div className="space-y-5">
                  {checkoutStep === 'DETAILS' ? (
                    <motion.div
                      key="details-form"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4 pt-2"
                    >
                      <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">Customer Roster Details</span>
                      
                      <div className="space-y-3 bg-neutral-900/60 p-4 rounded-2xl border border-white/5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-neutral-400 font-bold uppercase flex items-center gap-1"><User className="w-3 h-3" /> Full Name</label>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your name"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/40 transition"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-neutral-400 font-bold uppercase flex items-center gap-1"><Phone className="w-3 h-3" /> Phone Number</label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="e.g. +91 9876543210"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/40 transition"
                          />
                        </div>
                      </div>

                      <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-2xl flex gap-2.5 items-start">
                        <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-neutral-400 leading-relaxed">
                          We secure our kitchen logs with an instant mobile-verification check. To test in demo mode, click below and verify using passcode **123456**.
                        </p>
                      </div>

                      <button
                        onClick={handleSendOtp}
                        disabled={!name.trim() || !phone.trim()}
                        className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold rounded-xl text-xs active:scale-[0.98] disabled:opacity-40 transition shadow-lg flex items-center justify-center gap-1.5"
                      >
                        Send Verification Code
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="otp-form"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4 pt-2"
                    >
                      <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">Security Verification</span>

                      <div className="bg-neutral-900/60 p-5 rounded-2xl border border-white/5 text-center space-y-4">
                        <Key className="w-8 h-8 text-amber-500 mx-auto animate-pulse" />
                        <div className="space-y-1">
                          <p className="text-xs text-white font-semibold">Enter 6-Digit Passcode</p>
                          <p className="text-[10px] text-neutral-400">Sent secure code via SMS to {phone}</p>
                        </div>

                        <input
                          type="text"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••••"
                          className="w-40 text-center bg-white/5 border border-white/10 rounded-xl py-2.5 text-base tracking-widest text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/40 transition"
                        />
                      </div>

                      {otpError && (
                        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex gap-2 items-center text-red-400 text-[10px]">
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span className="font-semibold">{otpError}</span>
                        </div>
                      )}

                      <button
                        onClick={handleVerifyAndCheckout}
                        disabled={otp.length !== 6 || isPlacingOrder}
                        className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold rounded-xl text-xs active:scale-[0.98] disabled:opacity-40 transition shadow-lg flex items-center justify-center gap-1.5"
                      >
                        {isPlacingOrder ? 'Verifying Transaction...' : 'Verify & Place Kitchen Order'}
                      </button>
                    </motion.div>
                  )}
                </div>
              ) : (
                /* BASKET ITEMS LIST */
                <>
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-16">
                      <div className="p-4 bg-white/5 rounded-full">
                        <ShoppingBag className="w-10 h-10 text-neutral-700" />
                      </div>
                      <p className="text-neutral-400 text-sm font-medium">The group basket is empty</p>
                      <p className="text-neutral-600 text-xs px-6">
                        Anyone at Table #{tableNo} can add items — the cart updates live for everyone!
                      </p>
                    </div>
                  ) : (
                    cart.map((item) => {
                      const owner = (item as any).ownerName as string | undefined;
                      const isOwner = !owner || owner === guestName;
                      const colorClass = owner ? ownerColor((item as any).ownerId || owner) : LABEL_COLORS[0];

                      return (
                        <motion.div
                          key={item.menuItemId}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-3.5 bg-neutral-900/60 rounded-2xl border border-white/5 space-y-3"
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-white text-xs md:text-sm truncate">
                                {item.menuItem.name}
                              </h4>
                              <span className="text-[10px] text-amber-500/80 font-bold">
                                ₹{item.menuItem.price} each
                              </span>
                            </div>

                            {owner && (
                              <span className={`shrink-0 text-[8px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wide ${colorClass}`}>
                                {isOwner ? 'You' : owner.split(' ')[0]}
                              </span>
                            )}

                            {isOwner && (
                              <button
                                onClick={() => handleRemoveItem(item.menuItemId, item.menuItem.name, item.id)}
                                className="text-neutral-600 hover:text-red-400 p-1 rounded transition shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            {isOwner ? (
                              <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
                                <button
                                  onClick={() => handleUpdateQuantity(item.menuItemId, item.menuItem.name, -1, item.id)}
                                  className="p-1 text-neutral-400 hover:text-white rounded"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center text-xs font-bold text-white">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => handleUpdateQuantity(item.menuItemId, item.menuItem.name, 1, item.id)}
                                  className="p-1 text-neutral-400 hover:text-white rounded"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-neutral-500">
                                Qty: <strong className="text-white">{item.quantity}</strong>
                              </span>
                            )}

                            <span className="font-extrabold text-white text-xs md:text-sm">
                              ₹{item.quantity * item.menuItem.price}
                            </span>
                          </div>

                          {item.notes && (
                            <div className="text-[9px] italic text-neutral-400 bg-white/5 px-2 py-1.5 rounded">
                              "{item.notes}"
                            </div>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && checkoutStep !== 'SUCCESS' && (
              <div className="p-5 border-t border-white/10 bg-neutral-950/80 space-y-4 shrink-0">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-neutral-500 text-[10px] uppercase font-bold">
                    <span>Subtotal</span>
                    <span>₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between text-neutral-500 text-[10px] uppercase font-bold">
                    <span>GST (5%)</span>
                    <span>₹{gst}</span>
                  </div>
                  <div className="flex justify-between text-white font-extrabold text-sm pt-1.5 border-t border-white/5">
                    <span>Total Amount</span>
                    <span className="text-amber-400">₹{totalAmount}</span>
                  </div>
                </div>

                {!isCheckoutMode ? (
                  <button
                    onClick={() => setIsCheckoutMode(true)}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-extrabold rounded-xl transition shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] text-xs flex items-center justify-center gap-2"
                  >
                    Proceed to Verification & Checkout
                  </button>
                ) : null}

                {hasMultipleOwners && !isCheckoutMode && (
                  <p className="text-[9px] text-neutral-500 text-center leading-relaxed">
                    This completes and places <strong className="text-neutral-300">all items</strong> currently in Table #{tableNo}'s basket.
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
