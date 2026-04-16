import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { useStore } from './store/index';
import Login from './views/Login';
import ParentDashboard from './views/ParentDashboard';
import KidDashboard from './views/KidDashboard';
import FamilySetup from './views/FamilySetup';
import InviteCodeGate from './views/InviteCodeGate';
import SuperAdminPanel from './views/SuperAdminPanel';
import { LogOut, Loader, Shield } from 'lucide-react';

// Inner component so useNavigate works inside Router
const AppInner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentUser, logout, firebaseUser, familyId, isLoading, isNewFamily,
    needsInviteCode, systemAdminRole,
    nextAllowanceDate, distributeAllowance, generateRoutineQuests,
    setFirebaseUser, themeSettings,
  } = useStore();

  // ── Firebase Auth listener ─────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return unsub;
  }, [setFirebaseUser]);

  // ── Auto allowance check ───────────────────────────────────────
  useEffect(() => {
    if (!currentUser || !familyId) return;

    const checkTasks = () => {
      // 1. Routine Quests (Daily lock handled inside store)
      generateRoutineQuests();

      // 2. Allowance Distribution
      if (currentUser.role === 'primary_admin' || currentUser.role === 'co_admin') {
        distributeAllowance();
      }
    };

    // Check once immediately
    checkTasks();

    // Then check every minute (60000ms)
    const interval = setInterval(checkTasks, 60000);
    return () => clearInterval(interval);
  }, [currentUser, familyId, distributeAllowance, generateRoutineQuests, nextAllowanceDate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader size={36} className="animate-spin text-primary" />
        <p className="text-muted text-sm">連線至雲端...</p>
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'primary_admin' || currentUser?.role === 'co_admin';
  const isAdminRoute = location.pathname.startsWith('/admin');

  // Show the global header only for:
  // 1. Pure system admins (no family currentUser) — they need logout + admin panel button
  // 2. System admins on the /admin route — even if they have a family
  // Parents with a family get their own top bar inside ParentDashboard (no double header)
  const showGlobalHeader = systemAdminRole && (!currentUser || isAdminRoute);

  return (
    <div className="min-h-screen">
        {themeSettings?.backgroundUrl && (
          <div
            className="fixed inset-0 -z-50 pointer-events-none transition-all duration-1000"
            style={{
              backgroundImage: `url(${themeSettings.backgroundUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'brightness(0.35) saturate(1.2)'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 to-slate-950/80"></div>
          </div>
        )}
        {/* Global header: only for system admins (pure or on /admin route).
            Regular parents use ParentDashboard's own top bar to avoid double headers. */}
        {showGlobalHeader && (
          <header className="glass-card mb-4 flex justify-between items-center flex-wrap gap-2"
            style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <h1 className="text-lg font-bold">家庭預算系統</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {firebaseUser?.email && (
                <div className="text-xs text-muted hidden sm:block">{firebaseUser.email}</div>
              )}
              {!isAdminRoute && (
                <button
                  className="btn btn-ghost flex items-center gap-1 text-amber-400"
                  style={{ padding: '0.5rem' }}
                  onClick={() => navigate('/admin')}
                >
                  <Shield size={15} /> 管理員面板
                </button>
              )}
              <button className="btn btn-ghost" style={{ padding: '0.5rem' }} onClick={() => logout()}>
                <LogOut size={16} /> 登出
              </button>
            </div>
          </header>
        )}

        {/* Kids: full-screen. /admin: no container (SuperAdminPanel manages its own width).
            Parents/others: standard 680px container. */}
        <main className={currentUser?.role === 'kid' || isAdminRoute ? '' : 'container'}>
          <Routes>
            <Route
              path="/"
              element={
                !firebaseUser ? <Login /> :
                needsInviteCode ? <InviteCodeGate /> :
                isNewFamily ? <FamilySetup /> :
                !familyId ? (systemAdminRole ? <Navigate to="/admin" /> : <Login />) :
                !currentUser ? <Login /> :
                isAdmin ? <Navigate to="/parent" /> : <Navigate to="/kid" />
              }
            />
            <Route path="/parent/*" element={isAdmin ? <ParentDashboard /> : <Navigate to="/" />} />
            <Route path="/kid/*" element={currentUser?.role === 'kid' ? <KidDashboard /> : <Navigate to="/" />} />
            <Route path="/admin/*" element={systemAdminRole ? <SuperAdminPanel /> : <Navigate to="/" />} />
          </Routes>
        </main>
      </div>
  );
};

const App: React.FC = () => (
  <Router>
    <AppInner />
  </Router>
);

export default App;
