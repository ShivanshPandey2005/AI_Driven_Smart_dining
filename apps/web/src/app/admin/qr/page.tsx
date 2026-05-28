'use client';

import React, { useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Download, Printer, Grid3X3, Sparkles, Copy, Check } from 'lucide-react';

// Configurable table layout — extend for larger restaurants
const TABLES = Array.from({ length: 20 }, (_, i) =>
  String(i + 1).padStart(2, '0')
);

function getQrUrl(tableId: string): string {
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000';
  return `${base}/table/${tableId}`;
}

interface QrCardProps {
  tableId: string;
  selected: boolean;
  onSelect: (id: string) => void;
}

function QrCard({ tableId, selected, onSelect }: QrCardProps) {
  const url = getQrUrl(tableId);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadSvg = (e: React.MouseEvent) => {
    e.stopPropagation();
    const svg = document.getElementById(`qr-svg-${tableId}`);
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `table-${tableId}-qr.svg`;
    link.click();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect(tableId)}
      className={`relative group cursor-pointer rounded-2xl p-5 border transition-all duration-300 flex flex-col items-center gap-4 ${
        selected
          ? 'bg-amber-500/8 border-amber-500/40 shadow-lg shadow-amber-500/10'
          : 'bg-neutral-900/50 border-white/5 hover:border-white/10'
      }`}
    >
      {/* Selected badge */}
      {selected && (
        <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
          Selected
        </span>
      )}

      {/* Table label */}
      <div className="text-center">
        <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Table</p>
        <h3 className="text-2xl font-black text-white font-serif mt-0.5">#{tableId}</h3>
      </div>

      {/* QR Code */}
      <div className="p-3 bg-white rounded-xl shadow-inner">
        <QRCodeSVG
          id={`qr-svg-${tableId}`}
          value={url}
          size={130}
          bgColor="#ffffff"
          fgColor="#0a0a0a"
          level="H"
          includeMargin={false}
        />
      </div>

      {/* URL truncated */}
      <p className="text-[9px] text-neutral-500 font-mono text-center break-all max-w-[150px] leading-relaxed">
        {url.replace(/^https?:\/\//, '')}
      </p>

      {/* Actions (visible on hover / selected) */}
      <div className={`flex gap-2 transition-all duration-300 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button
          onClick={handleCopy}
          title="Copy URL"
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-semibold text-neutral-300 hover:text-white transition"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onClick={handleDownloadSvg}
          title="Download SVG"
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 rounded-lg text-[10px] font-semibold text-neutral-300 hover:text-amber-400 transition"
        >
          <Download className="w-3 h-3" />
          SVG
        </button>
      </div>
    </motion.div>
  );
}

export default function QrAdminPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [filterQuery, setFilterQuery] = useState('');

  const toggle = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const selectAll = () => setSelected(TABLES);
  const clearAll = () => setSelected([]);

  const handlePrint = () => {
    window.print();
  };

  const visibleTables = TABLES.filter((t) =>
    filterQuery ? t.includes(filterQuery.replace(/\D/g, '').padStart(2, '0').slice(-2)) : true
  );

  return (
    <main className="min-h-screen bg-[#070707] text-white font-sans">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
              <Grid3X3 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-bold font-serif gold-gradient-text">QR Table Manager</h1>
              <p className="text-[10px] text-neutral-400">Generate & print QR codes for every dining table</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Filter table…"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/40 w-32"
            />
            <button onClick={selectAll} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-neutral-300 hover:text-white transition">
              Select All
            </button>
            <button onClick={clearAll} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-neutral-300 hover:text-white transition">
              Clear
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black text-xs font-bold rounded-lg transition shadow-md"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Selected ({selected.length})
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Info banner */}
        <div className="glassmorphism rounded-2xl p-5 border border-purple-500/10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/15 shrink-0">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-white">How QR Sessions Work</h2>
            <p className="text-xs text-neutral-400 leading-relaxed max-w-2xl">
              Each QR code encodes a unique URL:&nbsp;
              <code className="text-amber-400 font-mono text-[10px] bg-black/30 px-1.5 py-0.5 rounded">
                /table/[tableId]
              </code>
              . Scanning it auto-creates or resumes an <strong className="text-white">active Redis-cached session</strong> with a&nbsp;
              <strong className="text-amber-400">4-hour expiry</strong>. Multiple guests at the same table share the same cart automatically — their browsers are connected in real-time via Socket.io.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Tables', value: TABLES.length },
            { label: 'Selected', value: selected.length },
            { label: 'Session TTL', value: '4 Hours' },
          ].map((s) => (
            <div key={s.label} className="glassmorphism rounded-xl p-4 border border-white/5 text-center">
              <p className="text-xl font-black text-amber-400">{s.value}</p>
              <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* QR Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {visibleTables.map((tableId) => (
            <QrCard
              key={tableId}
              tableId={tableId}
              selected={selected.includes(tableId)}
              onSelect={toggle}
            />
          ))}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          header, nav, .no-print { display: none !important; }
          .glassmorphism { background: white !important; border: 1px solid #ddd !important; }
          h3 { color: black !important; }
          p, span { color: #333 !important; }
        }
      `}</style>
    </main>
  );
}
