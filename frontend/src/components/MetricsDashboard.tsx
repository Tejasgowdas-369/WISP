import React, { useEffect, useState } from "react";
import { Layers, FileJson, Code, FileText, ChevronRight, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SourceData {
  id: string;
  name: string;
  type: string;
  original_tokens: number;
  compressed_tokens: number;
  duration_ms: number;
  timestamp: number;
}

interface Metrics {
  totalOriginalTokens: number;
  totalCompressedTokens: number;
  totalSavingsPct: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  countByType: Record<string, number>;
  savingsByType: Record<string, number>;
}

interface MetricsDashboardProps {
  metrics: Metrics;
  sources: SourceData[];
  activeSourceId: string | null;
  onSelectSource: (id: string) => void;
}

// Animated Counter component
const AnimatedNumber: React.FC<{ value: number; suffix?: string; prefix?: string }> = ({ value, suffix = "", prefix = "" }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;

    const duration = 800; // ms
    const startTime = performance.now();

    const updateNumber = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const easeProgress = progress * (2 - progress);
      const current = Math.round(start + (end - start) * easeProgress);
      
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(updateNumber);
      } else {
        setDisplayValue(end);
      }
    };

    requestAnimationFrame(updateNumber);
  }, [value]);

  return <span className="font-mono tabular-nums">{prefix}{displayValue.toLocaleString()}{suffix}</span>;
};

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  metrics,
  sources,
  activeSourceId,
  onSelectSource,
}) => {
  const getSourceIcon = (t: string) => {
    switch (t) {
      case "json": return <FileJson className="w-4 h-4 text-amber-400" />;
      case "code": return <Code className="w-4 h-4 text-indigo-400" />;
      case "rag": return <Layers className="w-4 h-4 text-emerald-400" />;
      default: return <FileText className="w-4 h-4 text-sky-400" />;
    }
  };

  // Compute SVG Donut Chart parameters
  const totalPruned = Object.values(metrics.countByType).reduce((a, b) => a + b, 0);
  
  // Calculate segments for the donut chart
  let cumulativePercent = 0;
  const donutSegments = Object.entries(metrics.countByType)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => {
      const percent = (count / (totalPruned || 1)) * 100;
      const startPercent = cumulativePercent;
      cumulativePercent += percent;
      
      let color = "#3B82F6"; // default blue
      if (type === "json") color = "#F59E0B"; // amber
      if (type === "code") color = "#6366F1"; // indigo
      if (type === "rag") color = "#10B981"; // emerald

      return { type, percent, startPercent, color };
    });

  // SVG parameters
  const radius = 36;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col h-full overflow-hidden">
      <h2 className="text-lg font-bold tracking-tight text-white mb-5">
        2. Session Metrics
      </h2>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl relative overflow-hidden">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
            Total Tokens Saved
          </span>
          <div className="text-2xl font-bold text-blue-400 font-mono">
            <AnimatedNumber value={Math.max(0, metrics.totalOriginalTokens - metrics.totalCompressedTokens)} />
          </div>
          <span className="text-[10px] text-gray-400">
            from <AnimatedNumber value={metrics.totalOriginalTokens} />
          </span>
          <div className="absolute top-0 right-0 w-12 h-12 bg-blue-500/5 rounded-full blur-md" />
        </div>

        <div className="bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl relative overflow-hidden">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
            Pruning Efficiency
          </span>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            <AnimatedNumber value={Math.round(metrics.totalSavingsPct)} suffix="%" />
          </div>
          <span className="text-[10px] text-gray-400">
            ratio: {(metrics.totalOriginalTokens / (metrics.totalCompressedTokens || 1)).toFixed(1)}x
          </span>
          <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/5 rounded-full blur-md" />
        </div>
      </div>

      {/* SVG Donut Chart Panel */}
      <div className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-xl mb-6 flex items-center justify-between">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r={radius}
              fill="transparent"
              stroke="rgba(255,255,255,0.03)"
              strokeWidth={strokeWidth}
            />
            {totalPruned === 0 ? (
              // Empty state circle
              <circle
                cx="50" cy="50" r={radius}
                fill="transparent"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth={strokeWidth}
              />
            ) : (
              donutSegments.map((seg, idx) => {
                const strokeDashoffset = circumference - (seg.percent / 100) * circumference;
                const strokeDasharray = `${circumference} ${circumference}`;
                const rotation = (seg.startPercent / 100) * 360;
                
                return (
                  <circle
                    key={idx}
                    cx="50" cy="50" r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{
                      transformOrigin: "50% 50%",
                      transform: `rotate(${rotation}deg)`,
                      transition: "stroke-dashoffset 0.8s ease-out"
                    }}
                  />
                );
              })
            )}
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-lg font-bold text-white font-mono">
              {totalPruned}
            </span>
            <span className="text-[8px] text-gray-500 uppercase font-semibold">Streams</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 pl-4 space-y-1.5 text-xs text-gray-400">
          {["prose", "json", "code", "rag"].map((type) => {
            const count = metrics.countByType[type] || 0;
            const savings = metrics.savingsByType[type] || 0;
            
            let colorDot = "bg-blue-500";
            if (type === "json") colorDot = "bg-amber-500";
            if (type === "code") colorDot = "bg-indigo-500";
            if (type === "rag") colorDot = "bg-emerald-500";

            return (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${colorDot}`} />
                  <span className="capitalize text-gray-300 font-medium">{type === "rag" ? "RAG" : type}</span>
                </div>
                <div className="font-mono text-[10px] text-gray-400">
                  {count > 0 ? `${savings}% saved` : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* History Ingested List */}
      <div className="flex-1 flex flex-col min-h-[150px] overflow-hidden">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">
          Ingestion History ({sources.length})
        </span>

        {sources.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center border border-dashed border-white/5 rounded-xl p-4 text-gray-500 text-xs">
            No history yet.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
            <AnimatePresence>
              {sources.map((src) => {
                const isActive = activeSourceId === src.id;
                const savings = src.original_tokens > 0
                  ? Math.round(((src.original_tokens - src.compressed_tokens) / src.original_tokens) * 100)
                  : 0;

                return (
                  <motion.div
                    key={src.id}
                    layoutId={`history-card-${src.id}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onClick={() => onSelectSource(src.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between glass-panel-hover ${
                      isActive
                        ? "bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-500/5"
                        : "bg-white/[0.02] border-white/5"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      <div className="p-2 rounded-lg bg-white/5 border border-white/5 flex-shrink-0">
                        {getSourceIcon(src.type)}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-semibold text-white truncate max-w-[120px]">
                          {src.name}
                        </h4>
                        <span className="font-mono text-[9px] text-gray-500">
                          {src.original_tokens} → {src.compressed_tokens} t
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-right">
                      <div>
                        <span className="text-xs font-bold text-emerald-400 font-mono block">
                          -{savings}%
                        </span>
                        <span className="font-mono text-[9px] text-gray-500 block flex items-center justify-end gap-0.5">
                          <Zap className="w-2 h-2 text-blue-500" />
                          {src.duration_ms.toFixed(0)}ms
                        </span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
