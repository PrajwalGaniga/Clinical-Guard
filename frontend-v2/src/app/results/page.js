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
  const [refresh, setRefresh] = useState(0);

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
        let url = `/records?page=${page}&limit=${limit}&risk=${riskFilter}&decision=${decisionFilter}`;

        const res = await api.get(url);
        setRecords(res.data.records || []);
        setTotal(res.data.total || 0);
      } catch (err) {
        setError('Failed to load records');
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [page, riskFilter, decisionFilter, isDemo, refresh]);

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
        <button className={styles.pageBtn} onClick={() => setRefresh(r => r + 1)} style={{ alignSelf: 'flex-start' }}>Retry Database Connection</button>
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
                  <div className={styles.emptyState}>No records found. Submit a record from Single Check or Batch Upload to see results here.</div>
                </td>
              </tr>
            ) : (
              records.map((r, i) => {
                const rowNum = (page - 1) * limit + i + 1;
                const timestamp = r.submitted_at || r.created_at || new Date().toISOString();
                const dateStr = new Date(timestamp).toLocaleDateString() + ' ' + new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                // Mappings compatible with both real backend AND demo logic
                const decisionStr = r.ml_result?.decision || r.verdict || 'UNKNOWN';
                const riskLvl = r.ml_result?.risk_level || r.risk_level || 'UNKNOWN';
                const confAuth = r.ml_result ? r.ml_result.confidence_authentic : (r.confidence_authentic || 0);
                const confPercent = (Math.min(confAuth, 100)).toFixed(1);
                
                const recData = r.record || r.original_data || {};
                const geminiText = r.gemini_reasoning || r.reasoning || 'No AI reasoning available.';
                const dataHash = r.blockchain?.data_hash || r.data_hash || 'N/A';
                const txHash = r.blockchain?.tx_hash || r.metadata?.blockchain_tx || 'Pending / N/A';

                let badgeRiskClass = styles.badgeLow;
                if (riskLvl === 'HIGH') badgeRiskClass = styles.badgeHigh;
                if (riskLvl === 'MEDIUM') badgeRiskClass = styles.badgeMed;

                return (
                  <Fragment key={r.id || r._id || i}>
                    <tr className={styles.tableRow} onClick={() => toggleRow(i)}>
                      <td>{rowNum}</td>
                      <td>{dateStr}</td>
                      <td>{r.trial_id || 'N/A'}</td>
                      <td>{r.site_id || 'N/A'}</td>
                      <td>
                        <span className={`${styles.badge} ${decisionStr.toUpperCase() === 'AUTHENTIC' ? styles.badgeAuth : styles.badgeMan}`}>
                          {decisionStr}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${badgeRiskClass}`}>
                          {riskLvl}
                        </span>
                      </td>
                      <td>{confPercent}%</td>
                      <td className={styles.hashCell} style={{ fontFamily: 'monospace' }}>{dataHash?.substring(0, 16) + '...'}</td>
                      <td style={{ color: 'var(--accent-blue)', fontSize: 20 }}>{expandedRow === i ? '▲' : '▼'}</td>
                    </tr>
                    
                    {expandedRow === i && (
                      <tr className={styles.expandedRow}>
                        <td colSpan="9">
                          <div className={styles.detailsGrid}>
                            {Object.keys(recData).slice(0, 13).map(key => (
                              <div key={key} className={styles.detailItem}>
                                <span className={styles.dLabel}>{key.replace(/_/g, ' ')}</span>
                                <span className={styles.dVal}>{
                                  typeof recData[key] === 'number' && recData[key] % 1 !== 0 
                                    ? recData[key].toFixed(2) 
                                    : recData[key]
                                }</span>
                              </div>
                            ))}
                          </div>
                          
                          <div className={styles.geminiBox}>
                            <div className={styles.geminiTitle}>✦ Gemini AI Reasoning</div>
                            <div className={styles.geminiText}>{geminiText}</div>
                          </div>
                          
                          <div className={styles.txBox} style={{ fontFamily: 'monospace' }}>
                            Full On-Chain Hash: {dataHash}
                            <br/>
                            Blockchain TX: {txHash}
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
          disabled={page * limit >= total || loading}
        >
          Next
        </button>
      </div>
    </div>
  );
}
