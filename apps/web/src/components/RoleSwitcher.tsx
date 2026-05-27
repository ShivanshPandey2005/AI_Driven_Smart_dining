'use client';

import React from 'react';
import { useDiningStore, UserRole } from '../store/diningStore';
import { Shield, User, ChefHat, ClipboardList } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RoleSwitcher() {
  const { role, setRole } = useDiningStore();

  const roles: { type: UserRole; label: string; icon: any; color: string }[] = [
    { type: 'CUSTOMER', label: 'Guest (Table)', icon: User, color: 'from-amber-500 to-yellow-400' },
    { type: 'KITCHEN', label: 'Kitchen (Live)', icon: ChefHat, color: 'from-purple-500 to-indigo-500' },
    { type: 'STAFF', label: 'Staff (Orders)', icon: ClipboardList, color: 'from-blue-500 to-cyan-500' },
    { type: 'ADMIN', label: 'Admin Panel', icon: Shield, color: 'from-emerald-500 to-teal-500' },
  ];

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5 p-1 glassmorphism rounded-full shadow-lg border border-white/5">
      {roles.map((r) => {
        const Icon = r.icon;
        const isActive = role === r.type;
        return (
          <button
            key={r.type}
            onClick={() => setRole(r.type)}
            className={`relative flex items-center justify-center p-2.5 rounded-full transition-all duration-300 group`}
            title={r.label}
          >
            {isActive && (
              <motion.div
                layoutId="activeRoleBg"
                className={`absolute inset-0 rounded-full bg-gradient-to-r ${r.color}`}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <Icon
              className={`w-4 h-4 z-10 transition-colors duration-300 ${
                isActive ? 'text-black font-bold' : 'text-neutral-400 group-hover:text-amber-400'
              }`}
            />
            <span className="absolute bottom-full right-0 mb-2 hidden group-hover:block whitespace-nowrap text-xs bg-neutral-900 text-white px-2.5 py-1 rounded-md shadow-md border border-white/10 z-50">
              {r.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
