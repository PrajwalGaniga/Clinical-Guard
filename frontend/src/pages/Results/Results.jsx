import { useState, useEffect } from 'react';
import api from '../../api';
import RiskBadge from '../../components/RiskBadge/RiskBadge';
import { useNavigate } from 'react-router-dom';
import styles from './Results.module.css';

export default function Results() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterRisk, setFilterRisk] = useState('ALL');
  const [filterDecision, setFilterDecision] = useState('ALL');
  const limit = 20;

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true); setError(null);
      try {
        const query = new URLSearchParams({ page, limit, ...(filterRisk !== 'ALL' && { risk: filterRisk }), ...(filterDecision !== 'ALL' && { decision: filterDecision }) });
        const res = await api.get(`/records?${query.toString()}`);
        setRecords(res.data.records || []);
        setTotal(res.data.total || 0);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load records.');
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [page, filterRisk, filterDecision]);

  if (error) return <div className={styles.error}>⚠️ {error}</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Clinical Audit Logs</h1>
        <p className={styles.subtitle}>Review cryptographic integrity records across all trial sites.</p>
      </header>

      <div className={styles.filterBar}>
        <select className={styles.select} value={filterRisk} onChange={(e) => { setFilterRisk(e.target.value); setPage(1); }}>
          <option value="ALL">All Risks</option>
          <option value="HIGH">High Risk</option>
          <option value="MEDIUM">Medium Risk</option>
          <option value="LOW">Low Risk</option>
        </select>
        <select className={styles.select} value={filterDecision} onChange={(e) => { setFilterDecision(e.target.value); setPage(1); }}>
          <option value="ALL">All Decisions</option>
          <option value="AUTHENTIC">Authentic</option>
          <option value="MANIPULATED">Manipulated</option>
        </select>
        <div className={styles.totalCount}>Found {total} records</div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Site ID</th>
              <th>Trial ID</th>
              <th>Date</th>
              <th>Risk</th>
              <th>Decision</th>
              <th>Data Hash</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i} className={styles.tr}><td colSpan={6}><div className="skeleton" style={{height:'14px', width:'100%'}}></div></td></tr>
              ))
            ) : records.length === 0 ? (
              <tr className={styles.tr}><td colSpan={6} className={styles.empty}>No records found matching your filters.</td></tr>
            ) : (
              records.map((r, i) => (
                <tr key={i} className={styles.tr}>
                  <td className={styles.boldText}>{r.site_id || 'UNK'}</td>
                  <td className={styles.monoText}>{r.trial_id || 'N/A'}</td>
                  <td className={styles.subText}>{new Date(r.submitted_at).toLocaleDateString()}</td>
                  <td><RiskBadge level={r.ml_result?.risk_level} /></td>
                  <td><span className={r.ml_result?.decision === 'AUTHENTIC' ? styles.tagAuth : styles.tagManip}>{r.ml_result?.decision}</span></td>
                  <td className={styles.monoText}>{r.blockchain?.data_hash?.slice(0, 16)}...</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={styles.pageBtn}>← Previous</button>
          <span className={styles.pageInfo}>Page {page} of {Math.ceil(total / limit) || 1}</span>
          <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className={styles.pageBtn}>Next →</button>
        </div>
      )}
    </div>
  );
}
