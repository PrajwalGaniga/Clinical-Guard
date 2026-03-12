'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../api';
import styles from './page.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'admin',
    hospital: '',
    site_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!formData.email) errs.email = 'Email is required.';
    if (!formData.password) errs.password = 'Password is required.';
    if (formData.password.length > 0 && formData.password.length < 6)
      errs.password = 'Password must be at least 6 characters.';
    if (formData.password !== formData.confirmPassword)
      errs.confirmPassword = 'Passwords do not match.';
    if (!formData.hospital) errs.hospital = 'Hospital name is required.';
    if (!formData.site_id) errs.site_id = 'Site ID is required (e.g. SITE_001).';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        email:   formData.email,
        password: formData.password,
        role:    formData.role,
        hospital: formData.hospital,
        site_id: formData.site_id
      });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. This email may already be registered.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.container}>
        <div className={`${styles.orb} ${styles.orb1}`}></div>
        <div className={`${styles.orb} ${styles.orb2}`}></div>
        <div className={styles.card}>
          <div className={styles.successBox}>
            <div className={styles.successIcon}>✓</div>
            <h2>Account Created!</h2>
            <p>Redirecting to the Sign In page in a moment...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={`${styles.orb} ${styles.orb1}`}></div>
      <div className={`${styles.orb} ${styles.orb2}`}></div>
      <div className={`${styles.orb} ${styles.orb3}`}></div>

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>ClinicalGuard</div>
          <div className={styles.subtitle}>Create your hospital admin account</div>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>

          <div className={styles.gridTwo}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Email Address *</label>
              <input
                type="email" name="email"
                className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
                value={formData.email} onChange={handleChange}
                placeholder="admin@hospital.org"
              />
              {fieldErrors.email && <span className={styles.fieldErr}>{fieldErrors.email}</span>}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Role *</label>
              <select name="role" className={styles.input} value={formData.role} onChange={handleChange}>
                <option value="admin">Administrator</option>
                <option value="investigator">Investigator</option>
                <option value="monitor">Trial Monitor (CRA)</option>
                <option value="regulator">Regulator / QA</option>
              </select>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Hospital / Facility Name *</label>
            <input
              type="text" name="hospital"
              className={`${styles.input} ${fieldErrors.hospital ? styles.inputError : ''}`}
              value={formData.hospital} onChange={handleChange}
              placeholder="Central Medical Research Institute"
            />
            {fieldErrors.hospital && <span className={styles.fieldErr}>{fieldErrors.hospital}</span>}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Site ID *</label>
            <input
              type="text" name="site_id"
              className={`${styles.input} ${fieldErrors.site_id ? styles.inputError : ''}`}
              value={formData.site_id} onChange={handleChange}
              placeholder="SITE_001"
            />
            {fieldErrors.site_id && <span className={styles.fieldErr}>{fieldErrors.site_id}</span>}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Password *</label>
            <input
              type="password" name="password"
              className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
              value={formData.password} onChange={handleChange}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
            />
            {fieldErrors.password && <span className={styles.fieldErr}>{fieldErrors.password}</span>}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Confirm Password *</label>
            <input
              type="password" name="confirmPassword"
              className={`${styles.input} ${fieldErrors.confirmPassword ? styles.inputError : ''}`}
              value={formData.confirmPassword} onChange={handleChange}
              placeholder="Repeat your password"
              autoComplete="new-password"
            />
            {fieldErrors.confirmPassword && <span className={styles.fieldErr}>{fieldErrors.confirmPassword}</span>}
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account & Continue'}
          </button>
        </form>

        <div className={styles.footer}>
          Already have an account? <Link href="/login" className={styles.link}>Sign In</Link>
        </div>
      </div>
    </div>
  );
}
