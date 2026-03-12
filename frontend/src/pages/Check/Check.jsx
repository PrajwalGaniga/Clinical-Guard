import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { DEMO_PREDICT } from '../../utils/demoData';
import { generatePDF } from '../../utils/generatePDF';
import RiskBadge from '../../components/RiskBadge/RiskBadge';
import styles from './Check.module.css';

const INITIAL_FORM = { age:'', bp_systolic:'', bp_diastolic:'', glucose:'', hr:'', spo2:'', diagnosis_encoded:'0', previous_trials:'0', product_experience:'0', last_trial_outcome:'0', trial_id:'', site_id:'' };

export default function Check() {
  const { user } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [computed, setComputed] = useState({ health_risk_score: 0, age_grp_adult: 0, age_grp_elderly: 0 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const age  = Number(form.age)         || 0;
    const sys  = Number(form.bp_systolic) || 0;
    const dia  = Number(form.bp_diastolic)|| 0;
    const glu  = Number(form.glucose)     || 0;
    const hr   = Number(form.hr)          || 0;
    const spo2 = Number(form.spo2)        || 0;

    // ── Component scores ─────────────────────────────────────────
    const bp_score =
      (sys > 160 || dia > 100) ? 0.40 :
      (sys > 140 || dia > 90)  ? 0.25 :
      (sys > 120 || dia > 80)  ? 0.10 : 0.05;

    const glucose_score =
      glu > 200 ? 0.35 :
      glu > 126 ? 0.20 :
      glu > 100 ? 0.10 : 0.05;

    const hr_score =
      (hr > 130 || hr < 45) ? 0.35 :
      (hr > 100 || hr < 55) ? 0.20 :
      (hr > 90  || hr < 60) ? 0.08 : 0.03;

    const spo2_score =
      (spo2 > 0 && spo2 < 88) ? 0.35 :
      (spo2 > 0 && spo2 < 92) ? 0.25 :
      (spo2 > 0 && spo2 < 95) ? 0.12 : 0.02;

    const age_score =
      age > 75 ? 0.10 :
      age > 65 ? 0.07 :
      age > 55 ? 0.04 : 0.02;

    const total = bp_score + glucose_score + hr_score + spo2_score + age_score;
    const hrs   = parseFloat(Math.min(Math.max(total, 0.05), 1.00).toFixed(2));

    setComputed({
      health_risk_score: hrs,
      age_grp_adult:   age >= 18 && age < 60 ? 1 : 0,
      age_grp_elderly: age >= 60 ? 1 : 0
    });
  }, [form]);

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(null); setError(''); setLoading(true);
    
    if (user?.email === 'demo@clinicalguard.com') {
      setTimeout(() => { setResult(DEMO_PREDICT); setLoading(false); }, 1500);
      return;
    }

    const computedHRS = parseFloat(computed.health_risk_score) || 0.05;
    const payload = {
      age:                parseFloat(form.age)               || 0,
      bp_systolic:        parseFloat(form.bp_systolic)        || 0,
      bp_diastolic:       parseFloat(form.bp_diastolic)       || 0,
      glucose:            parseFloat(form.glucose)            || 0,
      hr:                 parseFloat(form.hr)                 || 0,
      spo2:               parseFloat(form.spo2)               || 0,
      diagnosis_encoded:  parseInt(form.diagnosis_encoded)    || 0,
      previous_trials:    parseInt(form.previous_trials)      || 0,
      product_experience: parseFloat(form.product_experience) || 0,
      last_trial_outcome: parseFloat(form.last_trial_outcome) || 0,
      health_risk_score:  Math.max(computedHRS, 0.05),
      age_grp_adult:      computed.age_grp_adult,
      age_grp_elderly:    computed.age_grp_elderly,
      trial_id:           form.trial_id  || 'UNKNOWN',
      site_id:            form.site_id   || user?.site_id || 'UNKNOWN',
    };

    try {
      const res = await api.post('/predict/single', payload);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getColorClass = (val, type) => {
    if (!val) return styles.normal;
    const n = Number(val);
    if (type === 'sys') return n > 140 ? styles.abnormal : n > 120 ? styles.borderline : styles.normal;
    if (type === 'dia') return n > 90 ? styles.abnormal : n > 80 ? styles.borderline : styles.normal;
    if (type === 'glu') return n > 126 ? styles.abnormal : n > 100 ? styles.borderline : styles.normal;
    if (type === 'hr')  return n < 60 || n > 100 ? styles.abnormal : styles.normal;
    if (type === 'spo2') return n < 95 ? styles.abnormal : n < 98 ? styles.borderline : styles.normal;
    return styles.normal;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Single Record Verification</h1>
        <p className={styles.subtitle}>Enter clinical patient datums for real-time cryptographic audit.</p>
      </header>

      {error && <div className={styles.error}>⚠️ {error}</div>}

      <div className={styles.mainGrid}>
        <div className={styles.formSection}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.sectionTitle}>A. Patient Vitals</div>
            <div className={styles.grid2}>
              <div className={styles.formGroup}><label>Age</label><input type="number" required name="age" className="input" onChange={handleChange} value={form.age} /></div>
              <div className={styles.formGroup}><label>Heart Rate</label><input type="number" required name="hr" className="input" onChange={handleChange} value={form.hr} /></div>
              <div className={styles.formGroup}><label>BP Systolic</label><input type="number" required name="bp_systolic" className="input" onChange={handleChange} value={form.bp_systolic} /></div>
              <div className={styles.formGroup}><label>BP Diastolic</label><input type="number" required name="bp_diastolic" className="input" onChange={handleChange} value={form.bp_diastolic} /></div>
              <div className={styles.formGroup}><label>Glucose</label><input type="number" required name="glucose" className="input" onChange={handleChange} value={form.glucose} /></div>
              <div className={styles.formGroup}><label>SpO2 %</label><input type="number" required name="spo2" className="input" onChange={handleChange} value={form.spo2} /></div>
            </div>

            <div className={styles.sectionTitle}>B. Clinical Profile</div>
            <div className={styles.grid2}>
              <div className={styles.formGroup}><label>Diagnosis Encoded (0-4)</label><input type="number" required name="diagnosis_encoded" className="input" onChange={handleChange} value={form.diagnosis_encoded} /></div>
              <div className={styles.formGroup}><label>Previous Trials (0-10)</label><input type="number" required name="previous_trials" className="input" onChange={handleChange} value={form.previous_trials} /></div>
              <div className={styles.formGroup}><label>Product Exp (0-5)</label><input type="number" required name="product_experience" className="input" onChange={handleChange} value={form.product_experience} /></div>
              <div className={styles.formGroup}><label>Last Outcome (0/1)</label><input type="number" required name="last_trial_outcome" className="input" onChange={handleChange} value={form.last_trial_outcome} /></div>
            </div>

            <div className={styles.sectionTitle}>C. Metadata & Context</div>
            <div className={styles.grid2}>
              <div className={styles.formGroup}><label>Trial ID (Optional)</label><input type="text" name="trial_id" className="input" onChange={handleChange} value={form.trial_id} /></div>
              <div className={styles.formGroup}><label>Site ID (Optional)</label><input type="text" name="site_id" className="input" onChange={handleChange} value={form.site_id} /></div>
            </div>

            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? 'Running Integrity Analysis...' : 'Run Integrity Check →'}
            </button>
          </form>
        </div>

        <div className={styles.previewSection}>
          <div className={styles.previewCard}>
            <div className={styles.previewTitle}>Live Vitals Preview</div>
            
            <div className={styles.previewRow}>
              <span>Systolic BP</span>
              <span className={`${styles.previewVal} ${getColorClass(form.bp_systolic, 'sys')}`}>{form.bp_systolic || '—'} mmHg</span>
            </div>
            <div className={styles.previewRow}>
              <span>Diastolic BP</span>
              <span className={`${styles.previewVal} ${getColorClass(form.bp_diastolic, 'dia')}`}>{form.bp_diastolic || '—'} mmHg</span>
            </div>
            <div className={styles.previewRow}>
              <span>Glucose</span>
              <span className={`${styles.previewVal} ${getColorClass(form.glucose, 'glu')}`}>{form.glucose || '—'} mg/dL</span>
            </div>
            <div className={styles.previewRow}>
              <span>SpO2</span>
              <span className={`${styles.previewVal} ${getColorClass(form.spo2, 'spo2')}`}>{form.spo2 || '—'} %</span>
            </div>
            <div className={styles.previewRow}>
              <span>Heart Rate</span>
              <span className={`${styles.previewVal} ${getColorClass(form.hr, 'hr')}`}>{form.hr || '—'} bpm</span>
            </div>

            <div className={styles.sectionTitle} style={{marginTop: '24px'}}>Computed Heuristics</div>
            <div className={styles.computedRow}>
              <span>Age Grp Adult</span><span>{computed.age_grp_adult}</span>
            </div>
            <div className={styles.computedRow}>
              <span>Age Grp Elderly</span><span>{computed.age_grp_elderly}</span>
            </div>
            <div className={styles.scoreWrap}>
              <div className={styles.scoreHeader}>
                <span>Health Risk Score</span>
                <span>{computed.health_risk_score} / 1.00</span>
              </div>
              <div className={styles.scoreTrack}>
                <div className={styles.scoreFill} style={{
                  width: `${computed.health_risk_score * 100}%`,
                  background:
                    computed.health_risk_score > 0.60 ? '#ef4444' :
                    computed.health_risk_score > 0.30 ? '#f97316' :
                    '#10b981'
                }}></div>
              </div>
              <div style={{ fontSize: '0.7rem', marginTop: '4px', opacity: 0.7 }}>
                {computed.health_risk_score <= 0.30 ? '✓ Normal range' :
                 computed.health_risk_score <= 0.60 ? '⚠ Elevated risk' :
                 '⛔ High risk — expect MANIPULATED flag'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className={`${styles.resultCard} ${result.decision === 'AUTHENTIC' ? styles.resAuth : styles.resManip}`}>
          <div className={styles.resRow1}>
            <div className={styles.verdictBig}>{result.decision}</div>
            <div className={styles.badges}>
              <RiskBadge level={result.risk_level} />
              <div className={styles.chainLabel}>{result.blockchain_action.replace(/_/g, ' ')}</div>
            </div>
          </div>

          <div className={styles.resRow2}>
            <div className={styles.confCol}>
              <div className={styles.confLabel}>Authentic Confidence: {result.confidence_authentic?.toFixed(1)}%</div>
              <div className={styles.confTrack}><div className={styles.confFillTeal} style={{width: `${result.confidence_authentic}%`}}></div></div>
            </div>
            <div className={styles.confCol}>
              <div className={styles.confLabel}>Manipulated Confidence: {result.confidence_manipulated?.toFixed(1)}%</div>
              <div className={styles.confTrack}><div className={styles.confFillRed} style={{width: `${result.confidence_manipulated}%`}}></div></div>
            </div>
          </div>

          <div className={styles.resRow3}>
            <div className={styles.hashWrap}>
              <span className={styles.hashLabel}>SHA-256 HASH</span>
              <span className={styles.mono}>{result.data_hash?.slice(0, 16)}...{result.data_hash?.slice(-8)}</span>
            </div>
            <div className={styles.hashWrap}>
              <span className={styles.hashLabel}>BLOCKCHAIN TX</span>
              <span className={styles.mono}>{result.tx_hash ? `${result.tx_hash.slice(0,16)}...` : 'PENDING'}</span>
            </div>
          </div>

          <div className={styles.geminiBox}>
            <div className={styles.gemLabel}>✦ Gemini AI Analysis</div>
            <div className={styles.gemText}>{result.gemini_reasoning || 'No analysis provided.'}</div>
          </div>

          <button className={styles.downloadBtn} onClick={() => generatePDF(result, {...form, ...computed})}>
            📥 Download Signed PDF Report
          </button>
        </div>
      )}
    </div>
  );
}
