import React, { useState } from "react";
import { Play, FileText, Settings, Code, Layers, FileJson } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface IngestionPanelProps {
  onCompress: (name: string, text: string, type: string, settings: any) => Promise<void>;
  isLoading: boolean;
}

export const IngestionPanel: React.FC<IngestionPanelProps> = ({ onCompress, isLoading }) => {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [type, setType] = useState<"json" | "code" | "prose" | "rag">("prose");
  const [showSettings, setShowSettings] = useState(true);

  // Compression configuration states
  const [jsonDepth, setJsonDepth] = useState(4);
  const [jsonStrLen, setJsonStrLen] = useState(100);
  const [jsonArrItems, setJsonArrItems] = useState(3);

  const [codeLang, setCodeLang] = useState("python");
  const [codeSigOnly, setCodeSigOnly] = useState(true);

  const [proseRatio, setProseRatio] = useState(0.5);
  const [proseThreshold, setProseThreshold] = useState(0.60);

  const [ragThreshold, setRagThreshold] = useState(0.75);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    let settings: any = {};
    if (type === "json") {
      settings = { maxDepth: jsonDepth, maxStringLen: jsonStrLen, maxArrayItems: jsonArrItems };
    } else if (type === "code") {
      settings = { language: codeLang, signaturesOnly: codeSigOnly };
    } else if (type === "prose") {
      settings = { ratio: proseRatio, similarityThreshold: proseThreshold };
    } else if (type === "rag") {
      settings = { similarityThreshold: ragThreshold };
    }

    const sourceName = name.trim() || `Source [${type.toUpperCase()}] - ${new Date().toLocaleTimeString()}`;
    onCompress(sourceName, text, type, settings);
    // Keep text for now so the user doesn't lose it, or optionally clear
  };

  const getSourceIcon = (t: string) => {
    switch (t) {
      case "json": return <FileJson className="w-4 h-4" />;
      case "code": return <Code className="w-4 h-4" />;
      case "rag": return <Layers className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
          <span>1. Ingest Raw Stream</span>
        </h2>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            showSettings 
              ? "bg-blue-600/10 border-blue-500/30 text-blue-400" 
              : "bg-white/5 border-white/5 text-gray-400 hover:text-gray-200"
          }`}
          title="Toggle settings drawer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden space-y-4">
        {/* Name input */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Source Title / Label
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. users_api_dump, bot_agent_loop, logs_v4"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>

        {/* Text Input area */}
        <div className="flex-1 flex flex-col min-h-[160px] relative">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Input Payload (Raw Context)
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Paste data stream here...\n\nJSON, Python/JS source code, text logs, or a series of text chunks (separated by double newlines for RAG)...`}
            className="flex-1 w-full bg-white/[0.02] border border-white/5 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/30 resize-none font-code no-scrollbar"
          />
        </div>

        {/* Source Routing selectors */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Routing Compressor
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(["prose", "json", "code", "rag"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-all cursor-pointer ${
                  type === t
                    ? "bg-blue-600/10 border-blue-500/50 text-blue-400 shadow-lg shadow-blue-500/5"
                    : "bg-white/5 border-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/[0.08]"
                }`}
              >
                {getSourceIcon(t)}
                <span className="capitalize">{t === "rag" ? "RAG" : t}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Strategy Specific Settings Drawer */}
        <AnimatePresence initial={false}>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="overflow-hidden bg-white/[0.01] border border-white/[0.04] rounded-xl px-3"
            >
              <div className="py-3 space-y-3 text-xs">
                {type === "json" && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Max Nested Depth</span>
                      <span className="font-mono text-blue-400">{jsonDepth}</span>
                    </div>
                    <input
                      type="range" min="1" max="10" step="1"
                      value={jsonDepth} onChange={(e) => setJsonDepth(Number(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Max String Length</span>
                      <span className="font-mono text-blue-400">{jsonStrLen} chars</span>
                    </div>
                    <input
                      type="range" min="10" max="300" step="10"
                      value={jsonStrLen} onChange={(e) => setJsonStrLen(Number(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Max List/Array items</span>
                      <span className="font-mono text-blue-400">{jsonArrItems}</span>
                    </div>
                    <input
                      type="range" min="1" max="10" step="1"
                      value={jsonArrItems} onChange={(e) => setJsonArrItems(Number(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </>
                )}

                {type === "code" && (
                  <>
                    <div>
                      <span className="text-gray-400 block mb-1">Target Language</span>
                      <select
                        value={codeLang}
                        onChange={(e) => setCodeLang(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-white focus:outline-none"
                      >
                        <option value="python" className="bg-wisp-bg">Python</option>
                        <option value="javascript" className="bg-wisp-bg">JavaScript / TypeScript</option>
                        <option value="generic" className="bg-wisp-bg">Generic / Other</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-gray-400">Signatures Only</span>
                      <button
                        type="button"
                        onClick={() => setCodeSigOnly(!codeSigOnly)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                          codeSigOnly ? "bg-blue-600" : "bg-white/10"
                        }`}
                      >
                        <motion.div
                          layout
                          className="w-4 h-4 rounded-full bg-white shadow-md"
                          animate={{ x: codeSigOnly ? 16 : 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  </>
                )}

                {type === "prose" && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Retention Ratio</span>
                      <span className="font-mono text-blue-400">{Math.round(proseRatio * 100)}%</span>
                    </div>
                    <input
                      type="range" min="0.1" max="0.9" step="0.05"
                      value={proseRatio} onChange={(e) => setProseRatio(Number(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Sentence Similarity Thresh</span>
                      <span className="font-mono text-blue-400">{proseThreshold}</span>
                    </div>
                    <input
                      type="range" min="0.2" max="0.9" step="0.05"
                      value={proseThreshold} onChange={(e) => setProseThreshold(Number(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </>
                )}

                {type === "rag" && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Deduplication Similarity Thresh</span>
                      <span className="font-mono text-blue-400">{ragThreshold}</span>
                    </div>
                    <input
                      type="range" min="0.3" max="0.95" step="0.05"
                      value={ragThreshold} onChange={(e) => setRagThreshold(Number(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-[10px] text-gray-500 leading-tight block mt-1">
                      Chunks with similarity scores above this value will be pruned as redundant.
                    </span>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compress Trigger Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={isLoading || !text.trim()}
          className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold tracking-wide border cursor-pointer transition-all ${
            text.trim() && !isLoading
              ? "bg-blue-600 border-blue-500 text-white hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20"
              : "bg-white/5 border-white/5 text-gray-500 cursor-not-allowed"
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Pruning Context...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Prune Context</span>
            </>
          )}
        </motion.button>
      </form>
    </div>
  );
};
