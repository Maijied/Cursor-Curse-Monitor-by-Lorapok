import { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { fetchTags, triggerDeployment } from "../lib/api";
import Team from "./Team";
import { LogOut, AlertTriangle, LayoutDashboard, Rocket, Users, Activity, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate, Routes, Route, NavLink, useLocation } from "react-router-dom";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (!user) navigate("/login");
    });
    return unsub;
  }, [navigate]);

  if (!auth.currentUser) return null;

  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden text-slate-300">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between">
        <div>
          <div className="h-20 flex items-center px-6 border-b border-slate-800 gap-3">
            <img src="/assets/welcome-animation.svg" alt="Logo" className="w-8 h-8" />
            <h1 className="font-bold text-lg bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Cursor Monitor
            </h1>
          </div>
          
          <nav className="p-4 space-y-2">
            <NavLink 
              to="/dashboard"
              end
              className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive ? 'bg-indigo-500/10 text-indigo-400 font-medium' : 'hover:bg-slate-800/50 hover:text-slate-200'}`}
            >
              <LayoutDashboard size={20} />
              Overview
            </NavLink>
            <NavLink 
              to="/dashboard/deploy"
              className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive ? 'bg-indigo-500/10 text-indigo-400 font-medium' : 'hover:bg-slate-800/50 hover:text-slate-200'}`}
            >
              <Rocket size={20} />
              Deployments
            </NavLink>
            <NavLink 
              to="/dashboard/team"
              className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive ? 'bg-indigo-500/10 text-indigo-400 font-medium' : 'hover:bg-slate-800/50 hover:text-slate-200'}`}
            >
              <Users size={20} />
              Team Access
            </NavLink>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/30">
              {auth.currentUser.email?.[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-slate-200 truncate">{auth.currentUser.email}</p>
              <p className="text-xs text-slate-500">Administrator</p>
            </div>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
        <div className="p-8 max-w-6xl mx-auto">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/deploy" element={<DeployForm />} />
            <Route path="/team" element={<Team />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function Overview() {
  const stats = [
    { label: "Total Installs", value: "12,431", change: "+14%", icon: <Activity size={24} className="text-indigo-400" /> },
    { label: "Active Deployments", value: "3", change: "Stable", icon: <Rocket size={24} className="text-blue-400" /> },
    { label: "Error Rate", value: "0.12%", change: "-0.05%", icon: <AlertTriangle size={24} className="text-green-400" /> },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
        <p className="text-slate-400">Here's what's happening with the Cursor Curse Monitor extension.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-xl flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">{stat.label}</p>
              <h3 className="text-3xl font-bold text-white mb-2">{stat.value}</h3>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${stat.change.startsWith('+') ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {stat.change}
              </span>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-xl">
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-6">Recent Deployments</h3>
        <div className="space-y-4">
          {[
            { tag: "v1.0.1", channel: "Production", date: "2 hours ago", status: "success" },
            { tag: "v0.8.2", channel: "Beta", date: "Yesterday", status: "success" },
            { tag: "v0.8.1", channel: "Beta", date: "3 days ago", status: "failed" },
          ].map((log, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-4">
                {log.status === 'success' ? (
                  <CheckCircle2 size={20} className="text-emerald-500" />
                ) : (
                  <XCircle size={20} className="text-red-500" />
                )}
                <div>
                  <p className="font-semibold text-slate-200">{log.tag}</p>
                  <p className="text-xs text-slate-500">{log.channel} Channel</p>
                </div>
              </div>
              <span className="text-sm text-slate-400">{log.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeployForm() {
  const [tags, setTags] = useState<string[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  
  const [branch] = useState("main");
  const [channel, setChannel] = useState<"beta" | "production">("beta");
  const [selectedTag, setSelectedTag] = useState("");
  const [market, setMarket] = useState<"Both" | "Open VSX" | "VS Code Marketplace">("Both");
  const [tagsError, setTagsError] = useState<string | null>(null);

  useEffect(() => {
    fetchTags()
      .then((data) => {
        const tagNames = data.tags ?? [];
        setTags(tagNames);
        setTagsError(null);
        if (tagNames.length > 0) setSelectedTag(tagNames[0]);
      })
      .catch((err) => {
        console.warn("Failed to fetch tags", err);
        setTags([]);
        setTagsError(err.message || "Failed to load tags from API");
      });
  }, []);

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeploying(true);
    setMessage(null);
    try {
      await triggerDeployment({
        target_tag: selectedTag,
        publish_market: market,
        release_channel: channel === "production" ? "Production" : "Beta (Pre-release)",
      });
      setMessage({ type: 'success', text: `Deployment triggered for ${selectedTag} to ${channel}!` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
    setDeploying(false);
  };

  const filteredTags = tags.filter((t) => {
    if (channel === "production") return !/beta|alpha|rc/i.test(t);
    return /beta|alpha|rc/i.test(t) || t.startsWith("v0.");
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
      <h2 className="text-3xl font-bold text-white mb-2">Deploy Release</h2>
      <p className="text-slate-400 mb-8">Trigger a GitHub Actions workflow to publish the extension.</p>
      
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-xl">
        <form onSubmit={handleDeploy} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">Target Tag</label>
              <select 
                value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                {filteredTags.length === 0 && <option value="">No tags available</option>}
                {filteredTags.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">Target Market</label>
              <select 
                value={market} onChange={(e) => setMarket(e.target.value as typeof market)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                <option value="Open VSX">Open VSX</option>
                <option value="VS Code Marketplace">VS Code Marketplace</option>
                <option value="Both">Both</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3 text-slate-300">Release Channel</label>
            <div className="flex gap-4">
              <label className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl cursor-pointer border transition-all ${channel === 'beta' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300' : 'bg-slate-950 border-slate-700 hover:border-slate-600'}`}>
                <input type="radio" name="channel" value="beta" className="hidden" checked={channel === "beta"} onChange={(e) => setChannel(e.target.value)} />
                <div className="flex flex-col items-center">
                  <span className="font-bold">Beta Channel</span>
                  <span className="text-xs opacity-70">v0.x.x tags</span>
                </div>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl cursor-pointer border transition-all ${channel === 'production' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300' : 'bg-slate-950 border-slate-700 hover:border-slate-600'}`}>
                <input type="radio" name="channel" value="production" className="hidden" checked={channel === "production"} onChange={(e) => setChannel(e.target.value)} />
                <div className="flex flex-col items-center">
                  <span className="font-bold">Production</span>
                  <span className="text-xs opacity-70">v1.x.x tags</span>
                </div>
              </label>
            </div>
          </div>

          {tagsError && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {tagsError}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">Branch (Locked)</label>
            <input 
              value={branch} disabled
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 opacity-50 cursor-not-allowed text-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={deploying || filteredTags.length === 0}
            className="w-full mt-4 flex items-center justify-center gap-3 bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-500 transition-all shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50"
          >
            <Rocket size={20} />
            {deploying ? "Triggering Deployment..." : "Trigger Deployment"}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-xl flex items-start gap-4 shadow-xl ${
            message.type === 'success' ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300' : 'bg-red-950/40 border border-red-800 text-red-300'
          }`}>
            <div className="relative z-10 flex flex-col justify-center">
              {message.type === 'success' && <h3 className="font-bold text-lg mb-1 text-emerald-400">Deployment Triggered!</h3>}
              <p className="text-sm leading-relaxed">{message.text}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
