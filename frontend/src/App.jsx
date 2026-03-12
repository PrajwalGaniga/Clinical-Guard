import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar/Sidebar';
import MentorAI from './components/MentorAI/MentorAI';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Check from './pages/Check/Check';
import Upload from './pages/Upload/Upload';
import Results from './pages/Results/Results';
import Audit from './pages/Audit/Audit';
import { useAuth } from './context/AuthContext';

function AppLayout({ children }) {
  const { user } = useAuth();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{
        marginLeft: '220px',
        flex: 1,
        minHeight: '100vh',
        background: 'var(--bg-base)',
        padding: '28px',
        boxSizing: 'border-box',
        maxWidth: 'calc(100vw - 220px)',
        overflowX: 'hidden'
      }}>
        {user?.email === 'demo@clinicalguard.com' && (
          <div style={{
            background:'rgba(245,158,11,0.12)',
            borderBottom:'1px solid rgba(245,158,11,0.3)',
            padding:'8px 28px',
            fontSize:'12px', fontWeight:'600',
            color:'#FCD34D',
            display:'flex', alignItems:'center', gap:'8px',
            marginBottom: '20px', borderRadius: '8px'
          }}>
            🎮 DEMO MODE — Data is simulated. No API calls active.
          </div>
        )}
        {children}
      </main>
      <MentorAI />
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={
          isAuthenticated
            ? <Navigate to="/dashboard" replace />
            : <Login />
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <AppLayout><Dashboard /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/check" element={
          <ProtectedRoute roles={['admin','investigator']}>
            <AppLayout><Check /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/upload" element={
          <ProtectedRoute roles={['admin','investigator']}>
            <AppLayout><Upload /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/results" element={
          <ProtectedRoute>
            <AppLayout><Results /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/audit" element={
          <ProtectedRoute roles={['admin','monitor','regulator']}>
            <AppLayout><Audit /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
