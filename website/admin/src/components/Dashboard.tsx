import { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { fetchTags, triggerDeployment } from "../lib/api";
import Team from "./Team";
import { LogOut, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [tags, setTags] = useState<string[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  
  // Form state
  const [branch, setBranch] = useState("development");
  const [channel, setChannel] = useState("beta");
  const [selectedTag, setSelectedTag] = useState("");
  const [market, setMarket] = useState("open-vsx");
  
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (!user) navigate("/login");
    });
    return unsub;
  }, [navigate]);

  useEffect(() => {
    // Mock tags for UI testing if API fails
    fetchTags().then(data => {
      setTags(data.tags || []);
      if (data.tags && data.tags.length > 0) setSelectedTag(data.tags[0]);
    }).catch(err => {
      console.warn("API not ready, using fallback tags", err);
      const fbTags = ["v1.0.1", "v0.8.1", "v0.7.2", "v0.7.1"];
      setTags(fbTags);
      setSelectedTag(fbTags[0]);
    });
  }, []);

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeploying(true);
    setMessage(null);
    try {
      await triggerDeployment(selectedTag, branch, channel, market);
      setMessage({ type: 'success', text: `Deployment triggered for ${selectedTag} to ${channel}!` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
    setDeploying(false);
  };

  const filteredTags = tags.filter(t => {
    if (channel === "production") return t.startsWith("v1.");
    return t.startsWith("v0.");
  });

  if (!auth.currentUser) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="bg-slate-700 p-2 rounded-full shadow-lg border border-slate-600">
            <img src="/assets/security-shield.svg" alt="Auth" className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Authenticated as</p>
            <p className="font-semibold text-slate-200">{auth.currentUser.email}</p>
          </div>
        </div>
        <button 
          onClick={() => auth.signOut()}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
            <img src="/assets/monitor-dashboard.svg" alt="Deploy" className="w-7 h-7" />
            Deploy Release
          </h2>
          
          <form onSubmit={handleDeploy} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Branch (Locked)</label>
              <select 
                value={branch} onChange={(e) => setBranch(e.target.value)}
                disabled
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 opacity-50 cursor-not-allowed focus:outline-none"
              >
                <option value="development">development</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Release Channel</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" name="channel" value="beta" 
                    checked={channel === "beta"} onChange={(e) => setChannel(e.target.value)}
                    className="text-blue-500 focus:ring-blue-500" 
                  />
                  <span>Beta (v0.x.x)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" name="channel" value="production" 
                    checked={channel === "production"} onChange={(e) => setChannel(e.target.value)}
                    className="text-blue-500 focus:ring-blue-500" 
                  />
                  <span>Production (v1.x.x)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Target Tag</label>
              <select 
                value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {filteredTags.length === 0 && <option value="">No tags available</option>}
                {filteredTags.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Target Market</label>
              <select 
                value={market} onChange={(e) => setMarket(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="open-vsx">Open VSX</option>
                <option value="vscode-marketplace">VS Code Marketplace</option>
                <option value="both">Both</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={deploying || filteredTags.length === 0}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-bold hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg hover:shadow-blue-500/25 disabled:opacity-50"
            >
              {deploying ? "Triggering..." : "Trigger Deployment"}
            </button>
          </form>

          {message && (
            <div className={`mt-6 p-4 rounded-xl flex items-start gap-4 shadow-xl overflow-hidden relative ${
              message.type === 'success' ? 'bg-green-950/40 border border-green-800 text-green-300' : 'bg-red-950/40 border border-red-800 text-red-300'
            }`}>
              {message.type === 'success' && (
                <div className="absolute inset-0 bg-green-500/10 animate-pulse mix-blend-overlay"></div>
              )}
              {message.type === 'success' ? (
                <img src="/assets/deployment-success.png" alt="Success" className="w-16 h-16 rounded shadow-md object-cover relative z-10 border border-green-700" />
              ) : (
                <AlertTriangle size={24} className="shrink-0 relative z-10" />
              )}
              <div className="relative z-10 flex flex-col justify-center">
                {message.type === 'success' && <h3 className="font-bold text-lg mb-1 text-green-400">Deployment Triggered!</h3>}
                <p className="text-sm leading-relaxed">{message.text}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <Team />
        </div>
      </div>
    </div>
  );
}
