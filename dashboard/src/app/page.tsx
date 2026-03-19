'use client';

import { useEffect, useState } from 'react';

interface SystemStatus {
  timestamp: string;
  orchestrator: boolean;
  fileWatcher: boolean;
  gmailWatcher: boolean;
  mcp_servers: number;
  needs_action_count: number;
  approved_count: number;
  done_count: number;
}

export default function Home() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // Simulate system status (in production, this would call real API endpoints)
        const mockStatus: SystemStatus = {
          timestamp: new Date().toISOString(),
          orchestrator: true,
          fileWatcher: true,
          gmailWatcher: true,
          mcp_servers: 4,
          needs_action_count: 1,
          approved_count: 1,
          done_count: 2,
        };
        setStatus(mockStatus);
      } catch (error) {
        console.error('Error fetching status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black text-white">
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold mb-2">🤖 AI Employee System</h1>
          <p className="text-slate-400 text-lg">Autonomous Business Operations Dashboard</p>
        </div>

        {/* System Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-700 p-6 rounded-lg shadow-lg border border-slate-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Orchestrator</p>
                <p className="text-2xl font-bold">{status?.orchestrator ? '✅' : '❌'}</p>
              </div>
              <div className="text-4xl">⚙️</div>
            </div>
          </div>
          
          <div className="bg-slate-700 p-6 rounded-lg shadow-lg border border-slate-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">File Watcher</p>
                <p className="text-2xl font-bold">{status?.fileWatcher ? '✅' : '❌'}</p>
              </div>
              <div className="text-4xl">📁</div>
            </div>
          </div>

          <div className="bg-slate-700 p-6 rounded-lg shadow-lg border border-slate-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">MCP Servers</p>
                <p className="text-2xl font-bold">{status?.mcp_servers || 0}/4</p>
              </div>
              <div className="text-4xl">🔌</div>
            </div>
          </div>

          <div className="bg-slate-700 p-6 rounded-lg shadow-lg border border-slate-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Gmail Watcher</p>
                <p className="text-2xl font-bold">{status?.gmailWatcher ? '✅' : '⚠️'}</p>
              </div>
              <div className="text-4xl">📧</div>
            </div>
          </div>
        </div>

        {/* Vault Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-amber-900 bg-opacity-30 p-6 rounded-lg shadow-lg border border-amber-600 border-opacity-50">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              📝 Needs Action
              <span className="bg-amber-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                {status?.needs_action_count || 0}
              </span>
            </h3>
            <p className="text-amber-200 text-sm">Items awaiting AI reasoning and approval</p>
          </div>

          <div className="bg-blue-900 bg-opacity-30 p-6 rounded-lg shadow-lg border border-blue-600 border-opacity-50">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              ✅ Approved
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                {status?.approved_count || 0}
              </span>
            </h3>
            <p className="text-blue-200 text-sm">Ready for orchestrator execution</p>
          </div>

          <div className="bg-green-900 bg-opacity-30 p-6 rounded-lg shadow-lg border border-green-600 border-opacity-50">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              ✨ Completed
              <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                {status?.done_count || 0}
              </span>
            </h3>
            <p className="text-green-200 text-sm">Successfully executed actions</p>
          </div>
        </div>

        {/* MCP Servers */}
        <div className="bg-slate-700 p-6 rounded-lg shadow-lg border border-slate-600 mb-8">
          <h2 className="text-2xl font-bold mb-4">🔌 MCP Server Endpoints</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800 p-4 rounded border border-slate-600">
              <p className="font-semibold text-green-400">Communication</p>
              <code className="text-sm text-slate-300">POST http://localhost:3001/email/send</code>
            </div>
            <div className="bg-slate-800 p-4 rounded border border-slate-600">
              <p className="font-semibold text-green-400">Business Operations</p>
              <code className="text-sm text-slate-300">POST http://localhost:3002/financial/report</code>
            </div>
            <div className="bg-slate-800 p-4 rounded border border-slate-600">
              <p className="font-semibold text-green-400">Personal Assistance</p>
              <code className="text-sm text-slate-300">POST http://localhost:3003/calendar/event</code>
            </div>
            <div className="bg-slate-800 p-4 rounded border border-slate-600">
              <p className="font-semibold text-green-400">Integration</p>
              <code className="text-sm text-slate-300">POST http://localhost:3004/sync/cross-domain</code>
            </div>
          </div>
        </div>

        {/* Data Flow */}
        <div className="bg-slate-700 p-6 rounded-lg shadow-lg border border-slate-600">
          <h2 className="text-2xl font-bold mb-4">📊 System Data Flow</h2>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center">
            <div className="flex-1">
              <div className="text-3xl mb-2">External Event</div>
              <p className="text-slate-400 text-sm">(Email, File, Message)</p>
            </div>
            <div className="text-2xl">→</div>
            <div className="flex-1">
              <div className="text-3xl mb-2">📁 Needs_Action</div>
              <p className="text-slate-400 text-sm">Watcher creates .md file</p>
            </div>
            <div className="text-2xl">→</div>
            <div className="flex-1">
              <div className="text-3xl mb-2">🧠 AI Reasoning</div>
              <p className="text-slate-400 text-sm">Claude analyzes</p>
            </div>
            <div className="text-2xl">→</div>
            <div className="flex-1">
              <div className="text-3xl mb-2">✅ Approved</div>
              <p className="text-slate-400 text-sm">Human reviews</p>
            </div>
            <div className="text-2xl">→</div>
            <div className="flex-1">
              <div className="text-3xl mb-2">⚙️ Executed</div>
              <p className="text-slate-400 text-sm">Orchestrator runs</p>
            </div>
            <div className="text-2xl">→</div>
            <div className="flex-1">
              <div className="text-3xl mb-2">✨ Done</div>
              <p className="text-slate-400 text-sm">Logged & archived</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm py-8 border-t border-slate-700">
          <p>Last updated: {status?.timestamp ? new Date(status.timestamp).toLocaleTimeString() : 'Loading...'}</p>
          <p>Personal AI Employee Hackathon - 24/7 Autonomous Operations</p>
        </div>
      </div>
    </div>
  );
}
