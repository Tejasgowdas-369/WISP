import React from "react";
import { Shield, Trash2, Zap } from "lucide-react";
import { motion } from "framer-motion";

interface HeaderProps {
  connectionStatus: "connected" | "disconnected" | "connecting";
  onWipe: () => void;
  isWiping: boolean;
}

export const Header: React.FC<HeaderProps> = ({ connectionStatus, onWipe, isWiping }) => {
  return (
    <header className="glass-panel w-full py-4 px-6 md:px-8 flex items-center justify-between z-10 sticky top-0 rounded-b-2xl">
      <div className="flex items-center space-x-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/30">
          <Zap className="w-5 h-5 text-blue-500" />
          <motion.div
            className="absolute inset-0 rounded-xl bg-blue-500/20"
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            WISP
            <span className="text-xs font-normal text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 hidden md:inline">
              v1.0.0
            </span>
          </h1>
          <p className="text-xs text-gray-400 hidden sm:block">
            Working-set Intelligent Semantic Pruner
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Status Badge */}
        <div className="flex items-center space-x-2 bg-white/5 border border-white/5 rounded-full px-3 py-1 text-xs">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                connectionStatus === "connected"
                  ? "bg-emerald-400"
                  : connectionStatus === "connecting"
                  ? "bg-amber-400"
                  : "bg-red-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                connectionStatus === "connected"
                  ? "bg-emerald-500"
                  : connectionStatus === "connecting"
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
            />
          </span>
          <span className="text-gray-300 font-medium capitalize hidden md:inline">
            {connectionStatus}
          </span>
        </div>

        {/* Ephemeral Badge with Custom Hover Tooltip */}
        <div className="relative group flex items-center space-x-1.5 bg-blue-950/20 border border-blue-500/20 text-blue-400 rounded-full px-3 py-1 text-xs cursor-help">
          <Shield className="w-3.5 h-3.5" />
          <span className="font-medium">Local &amp; Ephemeral</span>
          
          <div className="absolute right-0 top-full mt-2 w-72 glass-panel p-4 rounded-xl shadow-xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300 z-50 text-gray-300 text-xs leading-relaxed">
            <h4 className="font-semibold text-white mb-1.5 flex items-center gap-1.5 text-blue-400">
              <Shield className="w-4 h-4" /> Zero-Persistence Guarantee
            </h4>
            <p className="mb-2">
              All ingestion records, compressed outputs, and metrics live strictly in Python server RAM and React component state.
            </p>
            <p>
              Closing this browser tab, shutting down the server, or clicking <strong>Wipe Now</strong> completely and permanently destroys all data.
            </p>
          </div>
        </div>

        {/* Wipe Now Button */}
        <motion.button
          whileHover={{ scale: 1.02, backgroundColor: "rgba(239, 68, 68, 0.15)", borderColor: "rgba(239, 68, 68, 0.4)" }}
          whileTap={{ scale: 0.97 }}
          onClick={onWipe}
          disabled={isWiping}
          className="flex items-center space-x-1.5 bg-red-950/10 border border-red-500/20 text-red-400 rounded-xl px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{isWiping ? "Wiping..." : "Wipe Now"}</span>
        </motion.button>
      </div>
    </header>
  );
};
