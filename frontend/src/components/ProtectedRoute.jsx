import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', background:'#0F1117', color:'#9CA3AF',
      fontFamily:'Inter,sans-serif', fontSize:'14px'
    }}>
      Loading...
    </div>
  );

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user?.role)) {
    return (
      <div style={{
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        height:'100vh', background:'#0F1117',
        color:'#9CA3AF', fontFamily:'Inter,sans-serif',
        gap:'12px'
      }}>
        <span style={{fontSize:'32px'}}>🔒</span>
        <h2 style={{color:'#F9FAFB',fontSize:'18px',margin:0}}>
          Access Denied
        </h2>
        <p style={{fontSize:'14px',margin:0}}>
          Your role ({user?.role}) cannot access this page.
        </p>
      </div>
    );
  }

  return children;
}
