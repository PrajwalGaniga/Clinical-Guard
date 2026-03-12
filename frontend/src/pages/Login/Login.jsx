import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);

    try {
      const res = await api.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      login(res.data.access_token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      const data = err.response?.data;
      if (data?.detail && typeof data.detail === 'string') {
        setError(data.detail);
      } else if (data?.detail && Array.isArray(data.detail)) {
        setError(data.detail[0]?.msg || 'Validation error from server');
      } else {
        setError('Invalid credentials. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = () => {
    const demoToken = btoa(JSON.stringify({
      sub: 'demo@clinicalguard.com',
      role: 'investigator',
      site_id: 'DEMO_SITE',
      hospital: 'Demo Hospital',
      exp: Date.now() + 86400000
    }));
    const fakeJWT = `demo.${demoToken}.signature`;
    const demoUser = {
      name: 'Demo User',
      email: 'demo@clinicalguard.com',
      role: 'investigator',
      site_id: 'DEMO_SITE',
      hospital: 'Demo Hospital'
    };
    login(fakeJWT, demoUser);
    navigate('/dashboard');
  };

  return (
    <div className={styles.container}>
      <div className={styles.circleBlue} />
      <div className={styles.circleTeal} />
      <div className={styles.circlePurple} />

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>✦</div>
          <h1 className={styles.title}>ClinicalGuard</h1>
          <p className={styles.subtitle}>Clinical Trial Data Integrity Platform</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Email Address</label>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="investigator@site.com"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>

        <div className={styles.divider} />
        
        <button type="button" onClick={handleDemoMode} className={styles.demoBtn}>
          🎮 Try Demo User
        </button>
      </div>
    </div>
  );
}
