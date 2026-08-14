import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AuthGuard from './lib/auth-guard';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center w-full">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard/*" element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          } />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
