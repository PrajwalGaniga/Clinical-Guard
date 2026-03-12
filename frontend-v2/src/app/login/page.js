'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Check for session-expired flag (set by AuthContext before redirect)
  const expired = typeof window !== 'undefined' &&
    sessionStorage.getItem('clinicalguard_session_expired') === 'true';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in both email and password.'); return; }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    params.toString(),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Invalid email or password.');
        setLoading(false);
        return;
      }

      if (data.access_token) {
        // Store token and user info
        sessionStorage.setItem('clinicalguard_token', data.access_token);
        sessionStorage.setItem('clinicalguard_user', JSON.stringify({
          email:    data.email,
          role:     data.role,
          hospital: data.hospital,
          site_id:  data.site_id || 'SITE_001',
        }));
        sessionStorage.removeItem('clinicalguard_session_expired');

        // Hard redirect — ensures AuthContext re-initializes cleanly
        window.location.href = '/dashboard';
      } else {
        setError('Login failed. Unexpected server response.');
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
