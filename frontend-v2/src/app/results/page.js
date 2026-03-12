'use client';

import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import styles from './page.module.css';

export default function ResultsPage() {
  const { user } = useAuth();
  
  // CRITICAL: ALL STATES DECLARED ABOVE ANY EFFECT OR JSX AS PER STRICT INSTRUCTIONS
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [decisionFilter, setDecisionFilter] = useState('ALL');
  const [expandedRow, setExpandedRow] = useState(null);

  const limit = 20;
  const isDemo = typeof window !== 'undefined' && sessionStorage.getItem('clinicalguard_demo') === 'true';

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      setError('');
      setExpandedRow(null);

      if (isDemo) {
        setTimeout(() => {
          let demoRecords = [
             { id: 'REC-101', site_id: 'SITE_001', trial_id: 'TR-10', created_at: new Date().toISOString(), verdict: 'Authentic', risk_level: 'LOW', confidence_authentic: 0.98, data_hash: 'a1b2c3d4e5f6g7h8i9j10', reasoning: 'All vitals within normal expected bounds.', metadata: { blockchain_tx: '0xabc123' }, original_data: { health_risk_score: 0.8, age: 45, hr: 75, spo2: 98, bp_systolic: 120, bp_diastolic: 80, glucose: 100 } },
             { id: 'REC-102', site_id: 'SITE_002', trial_id: 'TR-11', created_at: new Date(Date.now() - 3600000).toISOString(), verdict: 'Manipulated', risk_level: 'HIGH', confidence_authentic: 0.12, data_hash: 'f6e5d4c3b2a1g7h8i9j10', reasoning: 'Health risk score intentionally zeroed despite severe tachycardia and hypoxemia. SFO detected.', metadata: { blockchain_tx: '0xdef456' }, original_data: { health_risk_score: 0.0, age: 50, hr: 140, spo2: 85, bp_systolic: 160, bp_diastolic: 95, glucose: 180 } }
          ];

          if (riskFilter !== 'ALL') demoRecords = demoRecords.filter(r => r.risk_level === riskFilter);
          if (decisionFilter !== 'ALL') demoRecords = demoRecords.filter(r => r.verdict.toUpperCase() === decisionFilter);

          setRecords(demoRecords);
          setTotal(demoRecords.length);
          setLoading(false);
        }, 1000);
        return;
      }

      try {
        let url = `/records?page=${page}&limit=${limit}`;
        if (riskFilter !== 'ALL') url += `&risk_level=${riskFilter}`;
        if (decisionFilter !== 'ALL') url += `&verdict=${decisionFilter === 'AUTHENTIC' ? 'Authentic' : 'Manipulated'}`;

        const res = await api.get(url);
        setRecords(res.data.records);
        setTotal(res.data.total);
      } catch (err) {
        setError('Failed to load database records.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [page, riskFilter, decisionFilter, isDemo]);

  // Use useEffect to reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [riskFilter, decisionFilter]);

  const toggleRow = (index) => {
    if (expandedRow === index) setExpandedRow(null);
    else setExpandedRow(index);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}><div className={styles.title}>Results Database</div></div>
        <div style={{ color: 'var(--accent-red)' }}>{error}</div>
        <button className={styles.pageBtn} onClick={() => window.location.reload()} style={{ alignSelf: 'flex-start' }}>Retry Database Connection</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Global Results Database</div>
        <div className={styles.subtitle}>Immutable ledger of all verified and flagged clinical trial submissions.</div>
      </div>

      <div className={styles.controlsRow}>
        <div className={styles.filters}>
          <select 
            className={styles.select} 
            value={riskFilter} 
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            <option value="ALL">All Risk Levels</option>
            <option value="HIGH">HIGH Risk</option>
            <option value="MEDIUM">MEDIUM Risk</option>
            <option value="LOW">LOW Risk</option>
          </select>
          
          <select 
            className={styles.select} 
            value={decisionFilter} 
            onChange={(e) => setDecisionFilter(e.target.value)}
          >
            <option value="ALL">All Verdicts</option>
            <option value="AUTHENTIC">Authentic</option>
            <option value="MANIPULATED">Manipulated</option>
          </select>
        </div>
        
        <div className={styles.recordCount}>
          Showing {records.length} of {total} results
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.resultsTable}>
          <thead>
            <tr>
              <th>Row</th>
              <th>Date</th>
              <th>Trial ID</th>
              <th>Site ID</th>
              <th>Verdict</th>
              <th>Risk Level</th>
              <th>Confidence</th>
              <th>Hash Segment</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className={styles.skeletonRow}>
                  <td colSpan="9"></td>
                </tr>
              ))
            ) : records.length === 0 ? (
              <tr>
                <td colSpan="9">
                  <div className={styles.emptyState}>No records match your filters.</div>
                </td>
              </tr>
            ) : (
              records.map((r, i) => {
                const rowNum = (page - 1) * limit + i + 1;
                const dateStr = new Date(r.created_at).toLocaleDateString() + ' ' + new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const confPercent = ((r.verdict === 'Authentic' ? r.confidence_authentic : (1 - r.confidence_authentic)) * 100).toFixed(1);
                
                let badgeRiskClass = styles.badgeLow;
                if (r.risk_level === 'HIGH') badgeRiskClass = styles.badgeHigh;
                if (r.risk_level === 'MEDIUM') badgeRiskClass = styles.badgeMed;

                return (
                  <Fragment key={r.id || r._id || i}>
                    <tr className={styles.tableRow} onClick={() => toggleRow(i)}>
                      <td>{rowNum}</td>
                      <td>{dateStr}</td>
                      <td>{r.trial_id || 'N/A'}</td>
                      <td>{r.site_id || 'N/A'}</td>
                      <td>
                        <span className={`${styles.badge} ${r.verdict === 'Authentic' ? styles.badgeAuth : styles.badgeMan}`}>
                          {r.verdict}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${badgeRiskClass}`}>
                          {r.risk_level}
                        </span>
                      </td>
                      <td>{confPercent}%</td>
                      <td className={styles.hashCell}>{r.data_hash ? r.data_hash.substring(0, 16) + '...' : 'N/A'}</td>
                      <td style={{ color: 'var(--accent-blue)', fontSize: 20 }}>{expandedRow === i ? '▲' : '▼'}</td>
                    </tr>
                    
                    {expandedRow === i && (
                      <tr className={styles.expandedRow}>
                        <td colSpan="9">
                          <div className={styles.detailsGrid}>
                            {r.original_data && Object.keys(r.original_data).slice(0, 13).map(key => (
                              <div key={key} className={styles.detailItem}>
                                <span className={styles.dLabel}>{key.replace(/_/g, ' ')}</span>
                                <span className={styles.dVal}>{
                                  typeof r.original_data[key] === 'number' && r.original_data[key] % 1 !== 0 
                                    ? r.original_data[key].toFixed(2) 
                                    : r.original_data[key]
                                }</span>
                              </div>
                            ))}
                          </div>
                          
                          <div className={styles.geminiBox}>
                            <div className={styles.geminiTitle}>✦ Gemini AI Reasoning</div>
                            <div className={styles.geminiText}>{r.reasoning}</div>
                          </div>
                          
                          <div className={styles.txBox}>
                            Full On-Chain Hash: {r.data_hash}
                            <br/>
                            Blockchain TX: {r.metadata?.blockchain_tx || 'Pending / N/A'}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
