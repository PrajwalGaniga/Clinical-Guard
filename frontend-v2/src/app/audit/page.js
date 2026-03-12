'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import styles from './page.module.css';

export default function AuditPage() {
  const { user } = useAuth();
  
  // Strict rule: state declarations first
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);

  const limit = 15;
  const isDemo = typeof window !== 'undefined' && sessionStorage.getItem('clinicalguard_demo') === 'true';

  useEffect(() => {
    const fetchAudit = async () => {
      setLoading(true);
      setError('');

      if (isDemo) {
        setTimeout(() => {
          setLogs([
            { id: 1, action: 'MANIPULATION_DETECTED', details: 'Patient record flagged for severely manipulated vitals', risk_level: 'HIGH', user: 'investigator@demo.com', site_id: 'SITE_002', hospital: 'General Bio Labs', timestamp: new Date(Date.now() - 3600000).toISOString(), tx_hash: '0xdef4567890abcdef' },
            { id: 2, action: 'SFO_AUTO_DETECTED', details: 'Zeroed health_risk_score found with active trial outcomes.', risk_level: 'HIGH', user: 'investigator@demo.com', site_id: 'SITE_002', hospital: 'General Bio Labs', timestamp: new Date(Date.now() - 3650000).toISOString(), tx_hash: '0xSTUB_112233' },
            { id: 3, action: 'COMMIT', details: 'Standard record anchoring.', risk_level: 'LOW', user: 'doctor@site1.org', site_id: 'SITE_001', hospital: 'Central Health', timestamp: new Date(Date.now() - 86400000).toISOString(), tx_hash: '0xabc1234567890def' }
          ]);
          setTotal(3);
          setLoading(false);
        }, 1000);
        return;
      }

      try {
        const res = await api.get(`/audit?page=${page}&limit=${limit}`);
        setLogs(res.data.logs || res.data.audit_logs || res.data); // Based on how the backend returns it. Usually it's an array or a paginated dict.
        
        // Handle both possible pagination formats
        if (Array.isArray(res.data)) {
           setLogs(res.data);
           setTotal(res.data.length); // Assume no pagination if array
        } else {
           setLogs(res.data.logs || []);
           setTotal(res.data.total || (res.data.logs || []).length);
        }
      } catch (err) {
        setError('Failed to load audit logs.');
      } finally {
        setLoading(false);
      }
    };

    fetchAudit();
  }, [page, isDemo]);

  const totalPages = Math.ceil(total / limit) || 1;

  const getActionBadge = (action) => {
    switch (action) {
      case 'MANIPULATION_DETECTED': return styles.badgeMan;
      case 'SFO_AUTO_DETECTED': return styles.badgeSfo;
      default: return styles.badgeCommit;
    }
  };

  const getRiskColor = (risk) => {
    if (risk === 'HIGH') return 'var(--accent-red)';
    if (risk === 'MEDIUM') return 'var(--accent-orange)';
    return 'var(--text-secondary)';
  };

  if (error) {
    return (
        <div className={styles.container}>
          <div className={styles.header}><div className={styles.title}>System Audit Log</div></div>
          <div style={{ color: 'var(--accent-red)' }}>{error}</div>
          <button className={styles.pageBtn} onClick={() => window.location.reload()} style={{ alignSelf: 'flex-start' }}>Retry Database Connection</button>
        </div>
      );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>System Audit Log</div>
        <div className={styles.subtitle}>Immutable trail of system actions and high-risk flags. Available to monitors and regulators.</div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.logTable}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action Type</th>
              <th>Facility / User</th>
              <th>Risk Level</th>
              <th>Details</th>
              <th>Blockchain Verify</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
               Array.from({ length: 5 }).map((_, idx) => (
                 <tr key={idx} className={styles.skeletonRow}>
                   <td colSpan="6"></td>
                 </tr>
               ))
            ) : logs.length === 0 ? (
               <tr>
                 <td colSpan="6">
                   <div className={styles.emptyState}>No audit logs found.</div>
                 </td>
               </tr>
            ) : (
               logs.map((log, i) => {
                 const dateStr = new Date(log.timestamp).toLocaleString();
                 const isStub = !log.tx_hash || log.tx_hash.startsWith('0xSTUB') || log.tx_hash === 'PENDING';
                 
                 return (
                   <tr key={log.id || log._id || i} className={styles.tableRow}>
                     <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{dateStr}</td>
                     <td>
                       <span className={`${styles.badge} ${getActionBadge(log.action)}`}>
                         {log.action.replace(/_/g, ' ')}
                       </span>
                     </td>
                     <td>
                       <div className={styles.siteInfo}>{log.site_id} &mdash; {log.hospital || 'Unknown'}</div>
                       <div className={styles.hospitalInfo}>{log.user || 'system'}</div>
                     </td>
                     <td style={{ color: getRiskColor(log.risk_level), fontWeight: 600 }}>
                       {log.risk_level || 'N/A'}
                     </td>
                     <td className={styles.detailsText}>{log.details}</td>
                     <td>
                       {isStub ? (
                         <span className={`${styles.verifyBtn} ${styles.verifyBtnDisabled}`}>
                           (STUB Tx)
                         </span>
                       ) : (
                         <a 
                           href={`https://amoy.polygonscan.com/tx/${log.tx_hash}`} 
                           target="_blank" 
                           rel="noreferrer"
                           className={styles.verifyBtn}
                         >
                           Verify on Polygon ↗
                         </a>
                       )}
                     </td>
                   </tr>
                 );
               })
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <button 
          className={styles.pageBtn} 
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1 || loading}
        >
          Previous
        </button>
        <div className={styles.pageInfo}>Page {page} of {totalPages}</div>
        <button 
          className={styles.pageBtn} 
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || loading}
        >
          Next
        </button>
      </div>
    </div>
  );
}
