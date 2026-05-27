'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDiningStore, MenuItem } from '../store/diningStore';
import { Sparkles, X, Send, Bot, MessageSquare, Plus, Check, ShoppingBag, Clock, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import getSocket from '../lib/socket';

interface ChatMessage {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  createdAt: string;
  isStreaming?: boolean;
}

export default function AiCompanion({ menuItems }: { menuItems: MenuItem[] }) {
  const { sessionId, addToCartOptimistic, setIsCartOpen } = useDiningStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync historical messages when chat toggles or session changes
  useEffect(() => {
    if (!sessionId || !isOpen) return;

    const fetchChatHistory = async () => {
      try {
        const history = await api.getAiHistory(sessionId);
        // Format previous messages cleanly
        setMessages(history.map((h: any) => ({
          id: h.id,
          sender: h.sender,
          text: h.text,
          createdAt: h.createdAt,
        })));
      } catch (err) {
        console.error('Error fetching chat history:', err);
      }
    };
    fetchChatHistory();
  }, [sessionId, isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, isSending]);

  if (!sessionId) return null;

  // Suggestion Chip Handler
  const handleSuggestionClick = (query: string) => {
    setInputText(query);
  };

  const handleSendMessage = async (e: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customText || inputText).trim();
    if (!textToSend || isSending) return;

    setInputText('');
    setIsSending(true);

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'USER',
      text: textToSend,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      // Send message to server
      const reply = await api.sendAiMessage(sessionId, textToSend);

      // Check if response contains direct ADD_TO_CART_SUCCESS action tag
      const actionMatch = reply.text.match(/\[ACTION: ADD_TO_CART_SUCCESS \| id: (.*?) \| name: (.*?) \| qty: (\d+)\]/);
      if (actionMatch && actionMatch[1]) {
        const matchedItemId = actionMatch[1];
        const matchedQty = parseInt(actionMatch[3], 10);
        const menuItem = menuItems.find(item => item.id === matchedItemId);
        
        if (menuItem) {
          // Trigger local state optimistic update
          for (let i = 0; i < matchedQty; i++) {
            addToCartOptimistic(menuItem, 'Added via Zara AI');
          }
          // Emit socket notification to table
          const socket = getSocket();
          socket.emit('cart:item_added', {
            sessionId,
            item: {
              menuItemId: menuItem.id,
              menuItem,
              quantity: matchedQty,
              notes: 'Added via Zara AI'
            }
          });
          // Open cart automatically to show feedback
          setIsCartOpen(true);
        }
      }

      // Clean the raw action tags from conversational text so it looks professional
      const cleanedText = reply.text.replace(/\[ACTION: ADD_TO_CART_SUCCESS \|.*?\]/g, '').trim();

      // Trigger word-by-word premium typewriter streaming effect
      const tempAiMsgId = Math.random().toString();
      const words = cleanedText.split(' ');
      let currentWordIndex = 0;
      
      const newStreamingMsg: ChatMessage = {
        id: tempAiMsgId,
        sender: 'AI',
        text: '',
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, newStreamingMsg]);

      const interval = setInterval(() => {
        if (currentWordIndex < words.length) {
          const currentWordsText = words.slice(0, currentWordIndex + 1).join(' ');
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempAiMsgId ? { ...msg, text: currentWordsText } : msg
            )
          );
          currentWordIndex++;
        } else {
          clearInterval(interval);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempAiMsgId ? { ...msg, isStreaming: false } : msg
            )
          );
        }
      }, 50); // fast high-performance typing

    } catch (err) {
      console.error('Error sending message:', err);
      const errorMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: 'AI',
        text: 'Apologies, my digital kitchen circuits are busy cooking. Please try asking again in a moment!',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Helper that extracts dish names enclosed in asterisks (e.g. **Butter Chicken**)
   * and maps them to actual menu items for the customer to order directly!
   */
  const renderMessageContent = (msg: ChatMessage) => {
    const text = msg.text;
    
    // Parse double asterisks to bold tags
    const formattedText = text.split(/(\*\*[^*]+\*\*)/g).map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const cleanName = part.slice(2, -2);
        return <strong key={idx} className="text-amber-400 font-bold">{cleanName}</strong>;
      }
      return part;
    });

    // Detect recommended items and render purchase blocks
    const recommendedItems: MenuItem[] = [];
    menuItems.forEach((item) => {
      if (text.toLowerCase().includes(item.name.toLowerCase())) {
        if (!recommendedItems.find((r) => r.id === item.id)) {
          recommendedItems.push(item);
        }
      }
    });

    // Check if the message contains cart success action
    const isCartAddition = text.includes('Added to shared cart') || text.includes('successfully added');

    return (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-neutral-200 whitespace-pre-wrap">
          {formattedText}
          {msg.isStreaming && <span className="inline-block w-1.5 h-4 bg-amber-400 ml-1 animate-pulse" />}
        </p>

        {/* Render purchase recommendation cards if items are matched! */}
        {recommendedItems.length > 0 && msg.sender === 'AI' && (
          <div className="pt-2.5 space-y-2 border-t border-white/5 mt-2">
            <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">Dishes Mentioned</span>
            <div className="grid grid-cols-1 gap-2">
              {recommendedItems.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-black/40 rounded-xl border border-white/5 hover:border-amber-500/20 transition group"
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-10 h-10 rounded-md object-cover border border-white/10 shrink-0"
                    />
                    <div className="text-left">
                      <h5 className="text-xs font-bold text-white group-hover:text-amber-400 transition">{item.name}</h5>
                      <span className="text-[10px] text-amber-500 font-semibold">₹{item.price}</span>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      addToCartOptimistic(item, 'Added via Zara AI');
                      await api.addToCart(sessionId, item.id, 1);
                      setIsCartOpen(true);
                      const socket = getSocket();
                      socket.emit('cart:item_added', {
                        sessionId,
                        item: { menuItemId: item.id, menuItem: item, quantity: 1, notes: 'Added via Zara AI' }
                      });
                    }}
                    className="p-1.5 bg-amber-500 hover:bg-amber-600 text-black rounded-lg transition duration-300 active:scale-95 flex items-center gap-1 text-[10px] font-bold"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Render Success Card */}
        {isCartAddition && msg.sender === 'AI' && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl mt-2 text-emerald-400 text-xs">
            <Check className="w-4 h-4 shrink-0" />
            <span className="font-semibold">Shared Cart Updated Optimistically!</span>
          </div>
        )}
      </div>
    );
  };

  const suggestionChips = [
    { label: '🌶️ Spicy Cravings', query: 'Suggest some hot and spicy dishes!' },
    { label: '🥗 Light Bites', query: 'Suggest some light and healthy starters.' },
    { label: '🍛 Filling Mains', query: 'What are your most popular filling main dishes?' },
    { label: '🍰 Desserts', query: 'What sweet signature desserts do you recommend?' },
    { label: '🍹 Drinks', query: 'Show me refreshing Indian mocktails and lassis.' },
    { label: '🌟 Best Sellers', query: 'What are the all-time chef bestseller dishes?' }
  ];

  return (
    <>
      {/* Floating Chat Trigger Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <motion.button
          onClick={() => setIsOpen(true)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 rounded-full shadow-2xl flex items-center justify-center ring-4 ring-amber-500/30 text-black border border-amber-300/20 relative"
        >
          <Sparkles className="w-5 h-5 shrink-0 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </motion.button>
      </div>

      {/* Zara Sliding Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop Blur Mask */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
            />

            {/* Sliding Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 24, stiffness: 180 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-neutral-950 border-l border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-4 bg-gradient-to-r from-neutral-900 to-neutral-950 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-full flex items-center justify-center shadow-lg ring-2 ring-amber-500/40">
                    <Sparkles className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white font-serif flex items-center gap-1.5">
                      Zara <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">AI Butler</span>
                    </h3>
                    <span className="text-[10px] text-neutral-400 flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Same-Language Sync Active
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition duration-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Suggestions Panel */}
              <div className="px-4 py-2.5 bg-neutral-900/60 border-b border-white/5 flex gap-2 overflow-x-auto scrollbar-none shrink-0 select-none">
                {suggestionChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(chip.query)}
                    className="text-[10px] font-bold text-neutral-300 bg-neutral-850 hover:bg-amber-500/10 hover:text-amber-400 px-3 py-1.5 rounded-full border border-white/5 hover:border-amber-500/30 transition shrink-0 whitespace-nowrap active:scale-95"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Chat Messages Body */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth bg-gradient-to-b from-neutral-950 to-neutral-900"
              >
                {messages.length === 0 && !isSending && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center animate-bounce">
                      <Bot className="w-8 h-8 text-amber-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-extrabold text-white font-serif">Namaste! I am Zara.</p>
                      <p className="text-xs text-neutral-400 leading-relaxed max-w-xs">
                        Your premium AI butler. Tell me your mood, spice level, or allergies, and I will instantly tailor your dining session! Try tapping one of the chips above.
                      </p>
                    </div>
                  </div>
                )}

                {messages.map((msg) => {
                  const isAi = msg.sender === 'AI';
                  return (
                    <div key={msg.id} className={`flex gap-3 ${isAi ? '' : 'justify-end'}`}>
                      {isAi && (
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 shadow">
                          <Bot className="w-4 h-4 text-amber-500" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] p-3.5 rounded-2xl border ${
                          isAi
                            ? 'bg-neutral-900/90 border-white/5 text-left rounded-tl-none shadow-md'
                            : 'bg-gradient-to-br from-amber-500 to-yellow-400 border-amber-500/20 text-black text-left rounded-tr-none font-semibold shadow-lg'
                        }`}
                      >
                        {isAi ? renderMessageContent(msg) : <p className="text-xs md:text-sm leading-relaxed">{msg.text}</p>}
                      </div>
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-amber-500 animate-spin" />
                    </div>
                    <div className="bg-neutral-900/90 border border-white/5 p-3 rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Footer */}
              <form
                onSubmit={handleSendMessage}
                className="p-4 bg-neutral-950 border-t border-white/10 flex gap-2.5 shrink-0"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask Zara for spicy mains, dairy allergy checks..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/40 transition duration-300"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="p-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-extrabold rounded-xl transition duration-300 active:scale-95 flex items-center justify-center shrink-0 shadow-lg"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
