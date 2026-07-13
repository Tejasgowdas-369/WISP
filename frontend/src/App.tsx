import { useState, useEffect, useRef } from "react";
import { Header } from "./components/Header";
import { IngestionPanel } from "./components/IngestionPanel";
import { CompressionView } from "./components/CompressionView";
import { MetricsDashboard } from "./components/MetricsDashboard";

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

const BACKEND_URL = "http://127.0.0.1:8420";
const WS_URL = "ws://127.0.0.1:8420/ws";

function App() {
  const [sources, setSources] = useState<SourceData[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalOriginalTokens: 0,
    totalCompressedTokens: 0,
    totalSavingsPct: 0,
    totalOriginalBytes: 0,
    totalCompressedBytes: 0,
    countByType: { json: 0, code: 0, prose: 0, rag: 0 },
    savingsByType: { json: 0, code: 0, prose: 0, rag: 0 }
  });

  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [rehydratedContent, setRehydratedContent] = useState<Record<string, string>>({});
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [isLoadingCompress, setIsLoadingCompress] = useState(false);
  const [isLoadingRehydrate, setIsLoadingRehydrate] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);

  // Initialize WebSocket Connection
  useEffect(() => {
    connectWS();
    // Fetch initial HTTP state
    fetchState();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const connectWS = () => {
    setConnectionStatus("connecting");
    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === "state_update") {
          setSources(payload.sources);
          setMetrics(payload.metrics);
        }
      } catch (err) {
        console.error("Error reading WebSocket payload:", err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      // Reconnect after 3 seconds
      setTimeout(() => {
        connectWS();
      }, 3000);
    };

    ws.onerror = () => {
      setConnectionStatus("disconnected");
    };
  };

  const fetchState = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/state`);
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources);
        setMetrics(data.metrics);
        if (data.sources.length > 0 && !activeSourceId) {
          setActiveSourceId(data.sources[0].id);
        }
      }
    } catch (e) {
      console.warn("Could not fetch state via REST, waiting for WebSocket...");
    }
  };

  // REST API: Compress Stream
  const handleCompress = async (name: string, text: string, type: string, settings: any) => {
    setIsLoadingCompress(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/compress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, text, type, settings })
      });
      
      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      const payload = await res.json();
      const newSource = payload.data;
      
      // Select the newly created source
      setActiveSourceId(newSource.id);
    } catch (error) {
      console.error("Compression failed:", error);
      alert(`Compression error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoadingCompress(false);
    }
  };

  const handleRehydrate = async (id: string) => {
    if (rehydratedContent[id]) {
      const updated = { ...rehydratedContent };
      delete updated[id];
      setRehydratedContent(updated);
      return "";
    }
    
    setIsLoadingRehydrate(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/rehydrate/${id}`);
      if (!res.ok) {
        throw new Error("Source rehydration expired or not found in RAM");
      }
      const data = await res.json();
      setRehydratedContent(prev => ({
        ...prev,
        [id]: data.original_text
      }));
      return data.original_text;
    } catch (error) {
      console.error("Rehydration failed:", error);
      alert(`Failed to expand context: ${error instanceof Error ? error.message : String(error)}`);
      return "";
    } finally {
      setIsLoadingRehydrate(false);
    }
  };

  // REST API: Wipe Ephemeral State
  const handleWipe = async () => {
    if (!window.confirm("Are you sure you want to end this session? All context memory in server RAM and client state will be permanently wiped!")) {
      return;
    }
    
    setIsWiping(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/session`, { method: "DELETE" });
      if (res.ok) {
        // Reset local states
        setSources([]);
        setMetrics({
          totalOriginalTokens: 0,
          totalCompressedTokens: 0,
          totalSavingsPct: 0,
          totalOriginalBytes: 0,
          totalCompressedBytes: 0,
          countByType: { json: 0, code: 0, prose: 0, rag: 0 },
          savingsByType: { json: 0, code: 0, prose: 0, rag: 0 }
        });
        setActiveSourceId(null);
        setRehydratedContent({});
      }
    } catch (error) {
      console.error("Wiping failed:", error);
    } finally {
      setIsWiping(false);
    }
  };

  // Get active source detailed information
  const activeSource = sources.find(src => src.id === activeSourceId) || null;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header
        connectionStatus={connectionStatus}
        onWipe={handleWipe}
        isWiping={isWiping}
      />

      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-hidden max-w-[1600px] w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden">
          
          {/* Column 1: Ingestion Panel (4 spans) */}
          <div className="lg:col-span-4 h-full overflow-hidden">
            <IngestionPanel
              onCompress={handleCompress}
              isLoading={isLoadingCompress}
            />
          </div>

          {/* Column 2: Live Compression Viewer (5 spans) */}
          <div className="lg:col-span-5 h-full overflow-hidden">
            <CompressionView
              activeSource={activeSource}
              onRehydrate={handleRehydrate}
              rehydratedContent={rehydratedContent}
              isLoadingRehydrate={isLoadingRehydrate}
            />
          </div>

          {/* Column 3: Metrics Dashboard & History (3 spans) */}
          <div className="lg:col-span-3 h-full overflow-hidden">
            <MetricsDashboard
              metrics={metrics}
              sources={sources}
              activeSourceId={activeSourceId}
              onSelectSource={setActiveSourceId}
            />
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;
