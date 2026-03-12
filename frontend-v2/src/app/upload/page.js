'use client';

import { useState, useRef, useEffect, Fragment } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import styles from './page.module.css';

// ---------- CSV Template Data ----------
const TEMPLATE_HEADERS = [
  'trial_id','site_id','age','bp_systolic','bp_diastolic','glucose',
  'hr','spo2','diagnosis_encoded','previous_trials',
  'product_experience','last_trial_outcome','health_risk_score',
  'age_grp_adult','age_grp_elderly'
];

const TEMPLATE_NOTES = {
  trial_id:           'String — e.g. TR-001',
  site_id:            'String — e.g. SITE_001',
  age:                'Number (18–80)',
  bp_systolic:        'Number mmHg (90–160)',
  bp_diastolic:       'Number mmHg (60–100)',
  glucose:            'Number mg/dL (70–180)',
  hr:                 'Number BPM (50–130)',
  spo2:               'Number % (90–100)',
  diagnosis_encoded:  '0=COPD 1=Diabetes 2=HTN 3=Tachy 4=None',
  previous_trials:    'Integer ≥ 0',
  product_experience: '0=No 1=Yes',
  last_trial_outcome: '0=Adverse 1=Success',
  health_risk_score:  'Float (computed — 0.0 ≠ active patient, flags SFO)',
  age_grp_adult:      '1 if 18–59 else 0',
  age_grp_elderly:    '1 if ≥60 else 0',
};

const HISTORY_KEY = 'clinicalguard_upload_history';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function loadHistory() {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    const now = Date.now();
    return items.filter(item => now - item.ts < TTL_MS);
  } catch { return []; }
}

function saveHistory(items) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {}
}

export default function BatchUploadPage() {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [history, setHistory] = useState([]);
  const [showTemplate, setShowTemplate] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const parseWarnings = (fileObj) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split('\n');
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim());
      
      // Fix C: Pre-scan CSV client-side
      let missingCols = [];
      for (const reqCol of TEMPLATE_HEADERS) {
        if (!headers.includes(reqCol)) missingCols.push(reqCol);
      }
      if (missingCols.length > 0) {
        setError(`Missing columns: ${missingCols.join(', ')}`);
        setWarningCount(0);
        return;
      } else {
        setError(''); // clear any previous error if headers are valid
      }

      const hrsIdx = headers.indexOf('health_risk_score');
      if (hrsIdx === -1) return;
      let zeros = 0;
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',');
        if (Number(cols[hrsIdx]) === 0) zeros++;
      }
      setWarningCount(zeros);
    };
    reader.readAsText(fileObj);
  };

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); parseWarnings(f); }
  };
  const handleChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); parseWarnings(f); }
  };

  const downloadTemplate = () => {
    const csvRows = [
      TEMPLATE_HEADERS.join(','),
      'TR-10001,SITE_001,45,120,80,100,75,98,4,1,1,1,0.17,1,0',   // Row 1: Authentic
      'TR-10002,SITE_001,52,145,95,180,88,96,2,2,1,0,0.74,1,0',   // Row 2: Manipulated
      'TR-10003,SITE_001,58,155,98,190,110,93,1,3,2,0,0.00,1,0'   // Row 3: SFO (0.00 HRS)
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ClinicalGuard_Sample_Template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const processUpload = async () => {
    if (!file) return;
    setLoading(true); setError(''); setResults(null); setExpandedRow(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/predict/batch', formData);
      setResults(res.data);

      // Save to history
      const entry = {
        ts:       Date.now(),
        filename: file.name,
        total:    res.data.summary?.total_processed || res.data.batch_count || 0,
        auth:     res.data.summary?.authentic || 0,
        flagged:  res.data.summary?.manipulated || 0,
        results:  res.data.results || []
      };
      const updated = [entry, ...loadHistory()];
      setHistory(updated);
      saveHistory(updated);
    } catch (err) {
      let errorMsg = 'Batch processing failed. Please check the file format matches the template.';
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        errorMsg = detail.map(d => d.msg || JSON.stringify(d)).join(', ');
      } else if (detail) {
        errorMsg = JSON.stringify(detail);
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const downloadFlaggedCSV = (rows) => {
    if (!rows?.length) return;
    const flagged = rows.filter(r => r.verdict === 'Manipulated' || r.decision === 'MANIPULATED');
    if (!flagged.length) return;
    const headers = TEMPLATE_HEADERS.join(',') + ',verdict,risk_level,data_hash';
    const csvRows = flagged.map(r => {
      const od = r.original_data || {};
      return TEMPLATE_HEADERS.map(h => od[h] ?? '').join(',') +
        `,${r.verdict},${r.risk_level},${r.data_hash}`;
    });
    const blob = new Blob([[headers, ...csvRows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flagged_records_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Batch Upload & Scan</div>
          <div className={styles.subtitle}>Upload a CSV file of trial records for bulk ML + Blockchain analysis.</div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.templateBtn} onClick={() => setShowTemplate(v => !v)}>
            {showTemplate ? 'Hide' : 'View'} CSV Template
          </button>
          <button className={styles.downloadTplBtn} onClick={downloadTemplate}>
            ⬇ Download Template
          </button>
        </div>
      </div>

      {/* CSV Template Preview */}
      {showTemplate && (
        <div className={styles.templateBox}>
          <div className={styles.templateTitle}>Required CSV Columns (15 fields)</div>
          <div className={styles.templateGrid}>
            {TEMPLATE_HEADERS.map(h => (
              <div key={h} className={styles.templateCol}>
                <code className={styles.colName}>{h}</code>
                <span className={styles.colNote}>{TEMPLATE_NOTES[h]}</span>
              </div>
            ))}
          </div>
          <div className={styles.templateWarning}>
            ⚠️ <strong>SFO Rule:</strong> Any row where <code>health_risk_score = 0.00</code> but physiological vitals are normal will be auto-flagged as <strong>MANIPULATED</strong>.
          </div>
        </div>
      )}

      {/* Drop Zone */}
      {!results && !loading && (
        <>
          <div
            className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
            onDragEnter={handleDrag} onDragLeave={handleDrag}
            onDragOver={handleDrag} onDrop={handleDrop}
            onClick={() => inputRef.current.click()}
          >
            <div className={styles.dropIcon}>📄</div>
            <div className={styles.dropText}>
              {file ? file.name : 'Drop CSV here or click to browse'}
            </div>
            <div className={styles.dropSub}>
              {file ? `${(file.size / 1024).toFixed(1)} KB ready` : 'Must match the 15-column ClinicalGuard template'}
            </div>
            <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleChange} />
          </div>

          {warningCount > 0 && (
            <div className={styles.alertWarning}>
              ⚠️ {warningCount} rows have <code>health_risk_score = 0.00</code> — these will be flagged as SFO (Selective Field Omission).
            </div>
          )}

          {error && <div className={styles.alertError}>{error}</div>}

          {file && !error && (
            <button onClick={processUpload} className={styles.processBtn}>
              {warningCount > 0 ? `Process (${warningCount} SFO warnings)` : 'Run Batch Integrity Check'}
            </button>
          )}
        </>
      )}

      {/* Progress */}
      {loading && (
        <div className={styles.progressContainer}>
          <div className={styles.progressTitle}>Processing {file?.name}...</div>
          <div className={styles.progressBar}><div className={styles.progressFill}></div></div>
          <div className={styles.progressSub}>Running ML → Gemini AI → Polygon Blockchain for each record.</div>
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <>
          <div className={styles.summaryRow}>
            <div className={styles.summaryChip}>
              <span className={styles.chipLabel}>Total Processed</span>
              <span className={styles.chipVal}>{results.summary?.total_processed ?? results.batch_count ?? 0}</span>
            </div>
            <div className={styles.summaryChip}>
              <span className={styles.chipLabel}>✓ Authentic</span>
              <span className={`${styles.chipVal} ${styles.authColor}`}>{results.summary?.authentic ?? 0}</span>
            </div>
            <div className={styles.summaryChip}>
              <span className={styles.chipLabel}>✗ Flagged</span>
              <span className={`${styles.chipVal} ${styles.manColor}`}>{results.summary?.manipulated ?? 0}</span>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.resultsTable}>
              <thead>
                <tr>
                  <th>#</th><th>Site ID</th><th>Trial ID</th>
                  <th>Verdict</th><th>Risk</th><th>Hash</th><th></th>
                </tr>
              </thead>
              <tbody>
                {(results.results || []).map((r, i) => (
                  <Fragment key={i}>
                    <tr className={styles.tableRow} onClick={() => setExpandedRow(expandedRow === i ? null : i)}>
                      <td>{i + 1}</td>
                      <td>{r.original_data?.site_id ?? '—'}</td>
                      <td>{r.original_data?.trial_id ?? '—'}</td>
                      <td>
                        <span className={`${styles.badge} ${r.verdict === 'Authentic' ? styles.badgeAuth : styles.badgeMan}`}>
                          {r.verdict}
                        </span>
                      </td>
                      <td style={{ color: r.risk_level === 'HIGH' ? 'var(--accent-red)' : r.risk_level === 'MEDIUM' ? 'var(--accent-orange)' : 'var(--accent-teal)', fontWeight: 600 }}>
                        {r.risk_level}
                      </td>
                      <td className={styles.hashCell}>{r.data_hash?.substring(0, 14)}...</td>
                      <td style={{ color: 'var(--accent-blue)' }}>{expandedRow === i ? '▲' : '▼'}</td>
                    </tr>
                    {expandedRow === i && (
                      <tr className={styles.expandedRow}>
                        <td colSpan="7">
                          <div className={styles.detailsGrid}>
                            {['age','health_risk_score','bp_systolic','bp_diastolic','hr','spo2','glucose'].map(k => (
                              <div key={k} className={styles.detailItem}>
                                <span className={styles.dLabel}>{k.replace(/_/g,' ')}</span>
                                <span className={styles.dVal}>{r.original_data?.[k] ?? '—'}</span>
                              </div>
                            ))}
                          </div>
                          <div className={styles.geminiBox}>
                            <div className={styles.geminiTitle}>✦ Gemini AI Reasoning</div>
                            <div className={styles.geminiText}>{r.reasoning}</div>
                          </div>
                          <div className={styles.txBox}>Blockchain TX: {r.metadata?.blockchain_tx ?? 'Pending'}</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {(results.summary?.manipulated > 0) && (
            <button className={styles.downloadBtn} onClick={() => downloadFlaggedCSV(results.results)}>
              ⬇ Export Flagged Records CSV
            </button>
          )}

          <button className={styles.resetBtn} onClick={() => { setResults(null); setFile(null); setWarningCount(0); }}>
            Upload Another File
          </button>
        </>
      )}

      {/* 24h Upload History */}
      {history.length > 0 && (
        <div className={styles.historySection}>
          <div className={styles.historyHeader}>
            <div className={styles.historyTitle}>Upload History <span className={styles.historyBadge}>Last 24h</span></div>
          </div>
          <div className={styles.historyList}>
            {history.map((item, i) => {
              const age = Math.round((Date.now() - item.ts) / 60000);
              const ageStr = age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;
              return (
                <Fragment key={i}>
                  <div className={styles.historyItem} onClick={() => setHistoryExpanded(historyExpanded === i ? null : i)}>
                    <div className={styles.historyLeft}>
                      <span className={styles.historyFile}>📄 {item.filename}</span>
                      <span className={styles.historyTime}>{ageStr} — {new Date(item.ts).toLocaleTimeString()}</span>
                    </div>
                    <div className={styles.historyRight}>
                      <span className={styles.historyAuth}>✓ {item.auth}</span>
                      <span className={styles.historyFlag}>✗ {item.flagged}</span>
                      <span className={styles.historyTotal}>{item.total} total</span>
                      <span style={{ color: 'var(--accent-blue)' }}>{historyExpanded === i ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {historyExpanded === i && item.results?.length > 0 && (
                    <div className={styles.historyDetail}>
                      <table className={styles.resultsTable} style={{ fontSize: 12 }}>
                        <thead>
                          <tr><th>#</th><th>Trial ID</th><th>Site ID</th><th>Verdict</th><th>Risk</th></tr>
                        </thead>
                        <tbody>
                          {item.results.map((r, j) => (
                            <tr key={j}>
                              <td>{j + 1}</td>
                              <td>{r.original_data?.trial_id ?? '—'}</td>
                              <td>{r.original_data?.site_id ?? '—'}</td>
                              <td>
                                <span className={`${styles.badge} ${r.verdict === 'Authentic' ? styles.badgeAuth : styles.badgeMan}`}>
                                  {r.verdict}
                                </span>
                              </td>
                              <td>{r.risk_level}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {item.flagged > 0 && (
                        <button className={styles.downloadBtn} style={{ marginTop: 12 }} onClick={() => downloadFlaggedCSV(item.results)}>
                          ⬇ Export Flagged from this batch
                        </button>
                      )}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
