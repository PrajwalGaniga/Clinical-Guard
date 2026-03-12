import { useState, useEffect } from 'react';
import api from '../../api';
import RiskBadge from '../../components/RiskBadge/RiskBadge';
import { useAuth } from '../../context/AuthContext';
import styles from './Audit.module.css';

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const limit = 20;
  const { user } = useAuth();

  useEffect(() => {
    const fetchAudit = async () => {
      setLoading(true);
      setError(null);
      if (user?.email === 'demo@clinicalguard.com') {
        setTimeout(() => {
          setLogs([{ action: 'MANIPULATION_DETECTED', record_id: 'REC_DEMO', site_id: 'DEMO_SITE', hospital: 'Demo Hospital', timestamp: new Date().toISOString(), details: 'AI flagged anomalous vitals', risk_level: 'HIGH', data_hash: 'abc123...', tx_hash: '0xSTUB_demo_reject' }]);
          setTotal(1); setLoading(false);
        }, 500);
        return;
      }
      try {
        const res = await api.get(`/audit?page=${page}&limit=${limit}`);
        setLogs(res.data.logs || []);
        setTotal(res.data.total || 0);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to fetch audit logs.');
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, [page, user]);

  const verifyOnPolygon = (tx) => {
    if (!tx || tx.startsWith('0xSTUB')) return;
    window.open(`https://amoy.polygonscan.com/tx/${tx}`, '_blank');
  };

  const getActionBadge = (action) => {
    if (action.includes('MANIPULATION')) return styles.badgeRed;
    if (action.includes('SFO')) return styles.badgeOrange;
    return styles.badgeTeal;
  };

  if (error) return <div className={styles.error}>⚠️ {error}</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>System Audit Log</h1>
        <p className={styles.subtitle}>Immutable timeline of predictions and ledger transactions.</p>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th>Action</th>
              <th>Node / Site</th>
              <th>Record ID</th>
              <th>Risk</th>
              <th>Timestamp</th>
              <th>Verification</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i} className={styles.tr}><td colSpan={6}><div className="skeleton" style={{height:'14px', width:'100%'}}></div></td></tr>
              ))
            ) : logs.length === 0 ? (
              <tr className={styles.tr}><td colSpan={6} style={{textAlign:'center', padding:'40px', color:'var(--text-4)'}}>No audit records found.</td></tr>
            ) : (
              logs.map((log, i) => (
                <tr key={i} className={styles.tr}>
                  <td><span className={`${styles.actionBadge} ${getActionBadge(log.action)}`}>{log.action.replace(/_/g, ' ')}</span></td>
                  <td>
                    <div className={styles.boldText}>{log.site_id}</div>
                    <div className={styles.subText}>{log.hospital}</div>
                  </td>
                  <td className={styles.monoText}>{log.record_id}</td>
                  <td><RiskBadge level={log.risk_level} /></td>
                  <td className={styles.subText}>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>
                    <button 
                      className={styles.verifyBtn}
                      disabled={!log.tx_hash || log.tx_hash.startsWith('0xSTUB')}
                      onClick={() => verifyOnPolygon(log.tx_hash)}
                    >
                      ⛓️ Verify
                    </button>
                    {log.tx_hash?.startsWith('0xSTUB') && <div className={styles.stubText}>(Stub Mode)</div>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={styles.pageBtn}>← Prev</button>
          <span className={styles.pageInfo}>Page {page} of {Math.ceil(total / limit) || 1}</span>
          <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className={styles.pageBtn}>Next →</button>
        </div>
      )}
    </div>
  );
}
