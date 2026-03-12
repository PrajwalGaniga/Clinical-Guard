'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import styles from './page.module.css';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  
  const router = useRouter();
  const { login } = useAuth();

  // Check for session-expired flag (set by AuthContext before redirect)
  const expired = typeof window !== 'undefined' &&
    sessionStorage.getItem('cg_session_expired') === 'true';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in both email and password.'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams({ username: email, password }).toString(),
      });

      const data = await res.json();

      if (!res.ok) {
        let errorMsg = 'Invalid email or password.';
        const detail = data.detail;
        if (typeof detail === 'string') {
          errorMsg = detail;
        } else if (Array.isArray(detail)) {
          errorMsg = detail.map(d => d.msg || JSON.stringify(d)).join(', ');
        } else if (detail) {
          errorMsg = JSON.stringify(detail);
        }
        setError(errorMsg);
        setLoading(false);
        return;
      }

      console.log('Login successful, mapping user data:', data);

      if (data.access_token) {
        // Map flat response to user object
        const userData = {
          role: data.role,
          email: data.email,
          hospital: data.hospital
        };

        // Store token and user info using context
        sessionStorage.removeItem('cg_session_expired');
        login(userData, data.access_token);

        // Soft redirect to dashboard
        router.push('/dashboard');
      } else {
        setError('Login failed. Missing token in server response.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Cannot connect to the server. Is the backend running on port 8000?');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.orb} ${styles.orb1}`}></div>
      <div className={`${styles.orb} ${styles.orb2}`}></div>
      <div className={`${styles.orb} ${styles.orb3}`}></div>

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>ClinicalGuard</div>
          <div className={styles.subtitle}>Data Integrity Platform · Sign In</div>
        </div>

        {expired && (
          <div className={styles.warnBox}>
            ⚠️ Your session has expired. Please sign in again.
          </div>
        )}

        {error && <div className={styles.errorBox}>{error}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Email Address</label>
            <input
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@hospital.org"
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In to Workspace'}
          </button>
        </form>

        <div className={styles.footer}>
          New hospital?{' '}
          <Link href="/register" className={styles.link}>
            Create an admin account →
          </Link>
        </div>
      </div>
    </div>
  );
}
