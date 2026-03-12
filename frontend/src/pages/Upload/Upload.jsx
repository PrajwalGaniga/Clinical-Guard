import { useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import RiskBadge from '../../components/RiskBadge/RiskBadge';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import styles from './Upload.module.css';

export default function Upload() {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [sfoCount, setSfoCount] = useState(0);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const handleFileChange = (e) => {
    const uploaded = e.target.files[0];
    if (!uploaded) return;
    setFile(uploaded);
    setResults([]); setSummary(null); setError(''); setSfoCount(0);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n');
      if (lines.length < 2) return;
      const header = lines[0].toLowerCase().split(',');
      const hrsIdx = header.findIndex(h => h.trim() === 'health_risk_score');
      if (hrsIdx === -1) return;

      let zeros = 0;
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',');
        if (cols[hrsIdx] && (cols[hrsIdx].trim() === '0' || cols[hrsIdx].trim() === '0.00' || cols[hrsIdx].trim() === '0.0')) {
          zeros++;
        }
      }
      setSfoCount(zeros);
    };
    reader.readAsText(uploaded);
  };

  const handleUpload = async () => {
    if (!file) return;
    if (user?.email === 'demo@clinicalguard.com') {
      setError('Batch upload not supported in read-only Demo Mode.');
      return;
    }

    setLoading(true); setError('');
    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await api.post('/predict/batch', fd);
      setResults(res.data.results || []);
      setSummary(res.data.summary || null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to process batch CSV.');
    } finally {
      setLoading(false);
    }
  };

  const downloadFlaggedCSV = () => {
    const flagged = results.filter(r => r.decision === 'MANIPULATED');
    if (flagged.length === 0) return;
    
    const header = "Record Hash,Decision,Risk,Authentic%,Manipulated%,Action\n";
    const rows = flagged.map(r => `${r.data_hash},${r.decision},${r.risk_level},${r.confidence_authentic},${r.confidence_manipulated},${r.blockchain_action}\n`).join('');
    
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Flagged_Records.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Batch Upload</h1>
        <p className={styles.subtitle}>Upload CSV datasets for high-throughput anomaly scanning.</p>
      </header>

      {error && <div className={styles.error}>⚠️ {error}</div>}

      {sfoCount > 0 && (
        <div className={styles.warningBanner}>
          <span className={styles.warnIcon}>⚠️</span>
          <div>
            <strong>SFO Pattern Detected:</strong> {sfoCount} records show a <code>health_risk_score</code> of 0.00. 
            These will be auto-flagged as MANIPULATED by the SFO defense mechanism.
          </div>
        </div>
      )}

      <div className={styles.uploadCard}>
        <div className={styles.dropzone}>
          <input type="file" accept=".csv" onChange={handleFileChange} className={styles.fileInput} />
          <div className={styles.dropzoneContent}>
            <span className={styles.dropIcon}>📁</span>
            {file ? (
              <div className={styles.fileInfo}>
                <span className={styles.fileName}>{file.name}</span>
                <span className={styles.fileSize}>({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <div>Drop CSV file here or click to browse</div>
            )}
          </div>
        </div>

        <button className={styles.uploadBtn} disabled={!file || loading} onClick={handleUpload}>
          {loading ? 'Processing Array...' : 'Run Batch Analysis'}
        </button>
      </div>

      {loading && (
        <div className={styles.progressArea}>
          <div className={styles.progressTrack}><div className={styles.progressFill}></div></div>
          <div className={styles.progressText}>Scanning cryptographic fragments...</div>
        </div>
      )}

      {summary && (
        <div className={styles.summaryStrip}>
          <div className={styles.sumItem}>Verdicts: <strong>{summary.total}</strong></div>
          <div className={`${styles.sumItem} ${styles.sumTeal}`}>✓ Authentic: <strong>{summary.authentic}</strong></div>
          <div className={`${styles.sumItem} ${styles.sumRed}`}>✗ Flagged: <strong>{summary.manipulated}</strong></div>
          <div className={`${styles.sumItem} ${styles.sumOrange}`}>⚠ Pending: <strong>{summary.pending}</strong></div>
        </div>
      )}

      {results.length > 0 && (
        <div className={styles.resultsArea}>
          <div className={styles.tableHeader}>
            <h3 className={styles.tableTitle}>Batch Results</h3>
            <button className={styles.dlFlaggedBtn} onClick={downloadFlaggedCSV} disabled={summary?.manipulated === 0}>
              Download Flagged (.csv)
            </button>
          </div>
          
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Result Hash</th>
                  <th>Decision</th>
                  <th>Risk Level</th>
                  <th>Authentic %</th>
                  <th>Blockchain</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className={`${styles.tr} ${r.decision==='AUTHENTIC'?styles.rowAuth:styles.rowManip}`} onClick={() => setExpandedId(expandedId === i ? null : i)}>
                    <td className={styles.mono}>{r.data_hash?.slice(0,16)}...</td>
                    <td><span className={r.decision==='AUTHENTIC'?styles.tagAuth:styles.tagManip}>{r.decision}</span></td>
                    <td><RiskBadge level={r.risk_level} /></td>
                    <td>{r.confidence_authentic?.toFixed(1)}%</td>
                    <td className={styles.subText}>{r.blockchain_action?.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
