import React, { useState } from "react";
import { Eye, EyeOff, Layers, Zap, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SourceData {
  id: string;
  name: string;
  type: string;
  original_text: string;
  compressed_text: string;
  original_tokens: number;
  compressed_tokens: number;
  original_bytes: number;
  compressed_bytes: number;
  duration_ms: number;
}

interface CompressionViewProps {
  activeSource: SourceData | null;
  onRehydrate: (id: string) => Promise<string>;
  rehydratedContent: Record<string, string>;
  isLoadingRehydrate: boolean;
}

export const CompressionView: React.FC<CompressionViewProps> = ({
  activeSource,
  onRehydrate,
  rehydratedContent,
  isLoadingRehydrate,
}) => {
  const [viewMode, setViewMode] = useState<"side-by-side" | "compressed" | "original">("side-by-side");

  const isRehydrated = activeSource ? !!rehydratedContent[activeSource.id] : false;
  const displayText = isRehydrated && activeSource ? rehydratedContent[activeSource.id] : (activeSource?.compressed_text || "");

  const handleRehydrateClick = async () => {
    if (!activeSource) return;
    await onRehydrate(activeSource.id);
  };

  const getSourceTypeBadge = (t: string) => {
    const baseClass = "text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 border";
    switch (t) {
      case "json":
        return <span className={`${baseClass} bg-amber-500/10 border-amber-500/20 text-amber-400`}>JSON</span>;
      case "code":
        return <span className={`${baseClass} bg-indigo-500/10 border-indigo-500/20 text-indigo-400`}>Code</span>;
      case "rag":
        return <span className={`${baseClass} bg-emerald-500/10 border-emerald-500/20 text-emerald-400`}>RAG Chunks</span>;
      default:
        return <span className={`${baseClass} bg-sky-500/10 border-sky-500/20 text-sky-400`}>Prose</span>;
    }
  };

  if (!activeSource) {
    return (
      <div className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px] border border-white/[0.04]">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-center text-gray-500">
            <Layers className="w-8 h-8 opacity-40 animate-pulse" />
          </div>
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-emerald-500/20 rounded-2xl blur-lg opacity-30 -z-10" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">No Active Context Stream</h3>
        <p className="text-sm text-gray-400 max-w-sm">
          Select or paste raw text in the left pane to run semantic pruning and watch compression in real-time.
        </p>
      </div>
    );
  }

  const savingsPct = activeSource.original_tokens > 0 
    ? Math.round(((activeSource.original_tokens - activeSource.compressed_tokens) / activeSource.original_tokens) * 100)
    : 0;

  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col h-full overflow-hidden">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/[0.06] mb-4 gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-white truncate max-w-xs md:max-w-md">
              {activeSource.name}
            </h3>
            {getSourceTypeBadge(activeSource.type)}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1 font-mono text-[10px]">
              <Zap className="w-3 h-3 text-blue-500" />
              {activeSource.duration_ms.toFixed(1)}ms
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-600" />
            <span className="font-mono text-[10px]">
              {activeSource.original_tokens} → {isRehydrated ? activeSource.original_tokens : activeSource.compressed_tokens} tokens
            </span>
          </div>
        </div>

        {/* View Toggle and Rehydrate button */}
        <div className="flex items-center space-x-2 self-start md:self-center">
          {/* Rehydrate Trigger */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRehydrateClick}
            disabled={isLoadingRehydrate}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
              isRehydrated
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                : "bg-blue-600/10 border-blue-500/30 text-blue-400 hover:bg-blue-600/20"
            }`}
          >
            {isLoadingRehydrate ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : isRehydrated ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            <span>{isRehydrated ? "Collapse View" : "🔍 Expand Original"}</span>
          </motion.button>

          {/* Diff/Tabs option */}
          <div className="flex bg-white/5 border border-white/5 rounded-xl p-0.5 text-[11px] font-semibold">
            {(["side-by-side", "compressed", "original"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                  viewMode === mode
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <span className="capitalize">{mode.replace("-", " ")}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Diff Content Areas */}
      <div className="flex-1 overflow-hidden min-h-[300px] flex flex-col">
        <AnimatePresence mode="wait">
          {viewMode === "side-by-side" && (
            <motion.div
              key="side-by-side"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full overflow-hidden"
            >
              {/* Left pane: Original Text */}
              <div className="flex flex-col h-full overflow-hidden">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Raw Input ({activeSource.original_tokens} tokens)</span>
                  <span className="font-mono text-[9px] lowercase bg-white/5 px-1.5 py-0.5 rounded text-gray-400">
                    {Math.round(activeSource.original_bytes / 1024 * 100) / 100} KB
                  </span>
                </div>
                <div className="flex-1 bg-white/[0.01] border border-white/[0.05] rounded-2xl p-4 overflow-y-auto font-code text-xs text-gray-400 no-scrollbar select-text whitespace-pre-wrap leading-relaxed">
                  {activeSource.original_text}
                </div>
              </div>

              {/* Right pane: Compressed Text */}
              <div className="flex flex-col h-full overflow-hidden">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="text-blue-400 flex items-center gap-1">
                    Pruned ({activeSource.compressed_tokens} tokens)
                    <span className="text-emerald-400 font-mono text-[10px]">
                      -{savingsPct}%
                    </span>
                  </span>
                  <span className="font-mono text-[9px] lowercase bg-blue-500/5 px-1.5 py-0.5 rounded text-blue-300">
                    {Math.round(activeSource.compressed_bytes / 1024 * 100) / 100} KB
                  </span>
                </div>
                
                {/* Visual shrinking container with morph animation */}
                <motion.div
                  layoutId={`compressed-pane-${activeSource.id}`}
                  className="flex-1 bg-blue-950/[0.05] border border-blue-500/10 rounded-2xl p-4 overflow-y-auto font-code text-xs text-gray-200 no-scrollbar select-text whitespace-pre-wrap leading-relaxed relative"
                >
                  {/* Subtle electric glow behind compressed content */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
                  
                  <motion.div
                    key={isRehydrated ? "rehydrated" : "compressed"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {displayText}
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {viewMode === "compressed" && (
            <motion.div
              key="compressed-only"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col h-full overflow-hidden"
            >
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1.5">
                Pruned Block Output ({isRehydrated ? activeSource.original_tokens : activeSource.compressed_tokens} tokens)
              </div>
              <motion.div
                layoutId={`compressed-pane-${activeSource.id}`}
                className="flex-1 bg-blue-950/[0.05] border border-blue-500/10 rounded-2xl p-4 overflow-y-auto font-code text-xs text-gray-200 no-scrollbar select-text whitespace-pre-wrap leading-relaxed"
              >
                {displayText}
              </motion.div>
            </motion.div>
          )}

          {viewMode === "original" && (
            <motion.div
              key="original-only"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col h-full overflow-hidden"
            >
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Raw Input Block ({activeSource.original_tokens} tokens)
              </div>
              <div className="flex-1 bg-white/[0.01] border border-white/[0.05] rounded-2xl p-4 overflow-y-auto font-code text-xs text-gray-400 no-scrollbar select-text whitespace-pre-wrap leading-relaxed">
                {activeSource.original_text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
