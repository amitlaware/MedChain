import { useEffect, useState } from "react";
import api from "../services/api.js";

export default function AuditTrail({ entityId, title = "Blockchain Ledger Audit" }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedTx, setExpandedTx] = useState(null);

  useEffect(() => {
    load();
  }, [entityId]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/records/audit", { params: { entityId } });
      const sorted = (data.data || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLogs(sorted);
    } catch (err) {
      console.error("Audit load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const getActionTheme = (action) => {
    if (action.includes("UPLOAD") || action.includes("REGISTER")) return "emerald";
    if (action.includes("GRANT") || action.includes("TRANSFER")) return "blue";
    if (action.includes("READ") || action.includes("VIEW")) return "amber";
    if (action.includes("REVOKE") || action.includes("REJECT")) return "rose";
    return "slate";
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-0 shadow-xl overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary-500/20 p-2 rounded-lg">
            <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">{title}</h2>
            <p className="text-[10px] text-slate-400 font-mono">CHANNEL: mychannel | VERSION: 1.2</p>
          </div>
        </div>
        <button 
          onClick={load} 
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded text-[10px] font-bold transition-all border border-slate-700"
        >
          SYNC LEDGER
        </button>
      </div>

      <div className="p-6">
        <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar relative">
          {/* Vertical Line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-100"></div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <div className="w-8 h-8 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
              <p className="text-xs text-slate-500 font-mono animate-pulse">Querying Peer Nodes...</p>
            </div>
          )}

          {!loading && logs.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-slate-400 italic">Genesis block reached. No active transactions found.</p>
            </div>
          )}
          
          {logs.map((log, i) => {
            const theme = getActionTheme(log.action);
            const isExpanded = expandedTx === log.txId;

            return (
              <div key={log.txId + i} className="relative pl-12 group">
                {/* Node Circle */}
                <div className={`absolute left-0 top-0 h-10 w-10 rounded-full bg-white border-2 flex items-center justify-center z-10 transition-all ${
                  theme === 'emerald' ? 'border-emerald-500 text-emerald-500 shadow-emerald-100' :
                  theme === 'blue' ? 'border-blue-500 text-blue-500 shadow-blue-100' :
                  theme === 'amber' ? 'border-amber-500 text-amber-500 shadow-amber-100' :
                  'border-slate-300 text-slate-400'
                } shadow-md group-hover:scale-110`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter border ${
                        theme === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        theme === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        theme === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {log.action.replace('_', ' ')}
                      </span>
                      <span className="flex items-center gap-1 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-bold border border-slate-200">
                        <svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        CONSENSUS
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                      <span className="font-bold text-slate-400 uppercase text-[9px]">Initiator:</span>
                      <span className="font-mono bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-primary-700">
                        {log.actor ? (log.actor.includes('CN=') ? log.actor.split('CN=')[1].split('/')[0] : log.actor.substring(0, 15)) : 'SYSTEM'}
                      </span>
                    </div>

                    <div 
                      className="bg-slate-50 border border-slate-200 rounded-lg p-2 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => setExpandedTx(isExpanded ? null : log.txId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase font-mono">TXID</span>
                          <span className="text-[10px] font-mono text-slate-500">{log.txId.substring(0, 32)}...</span>
                        </div>
                        <svg className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-200 animate-in slide-in-from-top-2 duration-200">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Peer Nodes</p>
                              <div className="flex gap-1">
                                <span className="bg-emerald-100 text-emerald-700 px-1 rounded text-[8px] font-bold">peer0.org1</span>
                                <span className="bg-emerald-100 text-emerald-700 px-1 rounded text-[8px] font-bold">peer0.org2</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Validation</p>
                              <span className="text-emerald-600 text-[8px] font-black">VALIDATED & COMMITTED</span>
                            </div>
                          </div>
                          <div className="mt-3">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Payload Metadata</p>
                            <div className="bg-slate-900 rounded p-2 text-[10px] text-emerald-400 font-mono overflow-x-auto">
                              <pre>{JSON.stringify(log.details || {}, null, 2)}</pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
