'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import ResultCard from '../../components/ResultCard';
import api from '../../api';
import styles from './page.module.css';

export default function SingleCheckPage() {
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    trial_id: 'TR-10495',
    site_id: 'SITE_001',
    age: 45,
    bp_systolic: 120,
    bp_diastolic: 80,
    glucose: 100,
    hr: 75,
    spo2: 98,
    diagnosis_encoded: 4, // 0: COPD, 1: Diabetes, 2: Hypertension, 3: Tachycardia, 4: None
    previous_trials: 0,
    product_experience: 0,
    last_trial_outcome: 1
  });

  const [computed, setComputed] = useState({
    health_risk_score: 0.0,
    age_grp_adult: 1,
    age_grp_elderly: 0
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const isDemo = typeof window !== 'undefined' && sessionStorage.getItem('clinicalguard_demo') === 'true';

  // Compute live logic based on vitals automatically
  useEffect(() => {
    const age = Number(formData.age) || 0;
    const sys = Number(formData.bp_systolic) || 0;
    const dia = Number(formData.bp_diastolic) || 0;
    const hr = Number(formData.hr) || 0;
    const spo2 = Number(formData.spo2) || 0;
    const gluc = Number(formData.glucose) || 0;

    let score = 0;
    if (sys > 140 || sys < 90) score += 1.5;
    if (dia > 90 || dia < 60) score += 1.0;
    if (hr > 100 || hr < 60) score += 1.2;
    if (spo2 < 95) score += 2.0;
    if (gluc > 140 || gluc < 70) score += 1.0;
    
    // Exact SFO simulation if user zeroes it out manually it will be overridden in state later if not careful
    // But since it's computed, we will just calculate it. 
    // To allow SFO, we'll let user override it if they type, but typical flow computes it.
    // For simplicity of specification: "health_risk_score calculates from vitals automatically"
    
    setComputed({
      health_risk_score: parseFloat(score.toFixed(2)),
      age_grp_adult: (age >= 18 && age < 60) ? 1 : 0,
      age_grp_elderly: age >= 60 ? 1 : 0
    });
  }, [formData.age, formData.bp_systolic, formData.bp_diastolic, formData.hr, formData.spo2, formData.glucose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    const fullRecord = { ...formData, ...computed };
    
    // Ensure numbers are parsed correctly for ML
    const parsedRecord = {
      trial_id: String(fullRecord.trial_id),
      site_id: String(fullRecord.site_id),
      age: Number(fullRecord.age),
      bp_systolic: Number(fullRecord.bp_systolic),
      bp_diastolic: Number(fullRecord.bp_diastolic),
      glucose: Number(fullRecord.glucose),
      hr: Number(fullRecord.hr),
      spo2: Number(fullRecord.spo2),
      health_risk_score: Number(fullRecord.health_risk_score),
      age_grp_adult: Number(fullRecord.age_grp_adult),
      age_grp_elderly: Number(fullRecord.age_grp_elderly),
      diagnosis_encoded: Number(fullRecord.diagnosis_encoded),
      previous_trials: Number(fullRecord.previous_trials),
      product_experience: Number(fullRecord.product_experience),
      last_trial_outcome: Number(fullRecord.last_trial_outcome)
    };

    if (isDemo) {
      setTimeout(() => {
        setResult({
          verdict: 'Manipulated',
          risk_level: 'HIGH',
          confidence_authentic: 0.12,
          confidence_manipulated: 0.88,
          data_hash: 'db3c8b4f17711b7d5a574676878b4d81223e7e22119ed022a18f4g3a',
          reasoning: 'The Health Risk Score is 0.00 while the patient has extreme tachycardia (140 hr) and high blood pressure. This completely contradicts physiological reality and suggests Selective Field Omission (SFO) to fake trial criteria.',
          metadata: { sfo_detected: true, blockchain_status: 'Anchored', blockchain_tx: '0x123abc456def7890' }
        });
        setLoading(false);
      }, 1500);
      return;
    }

    try {
      const res = await api.post('/predict/single', parsedRecord);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Prediction failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Vitals color helpers
  const getVitalClass = (val, min, max, warnMin, warnMax) => {
    const num = Number(val);
    if (num < warnMin || num > warnMax) return styles.previewItemDanger;
    if (num < min || num > max) return styles.previewItemWarning;
    return styles.previewItemNormal;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Single Record Integrity Check</div>
        <div className={styles.subtitle}>Enter vital signs and trial parameters to scan for manipulation.</div>
      </div>

      <div className={styles.contentRow}>
        <div className={styles.formPanel}>
          <form onSubmit={handleSubmit}>
            
            <div className={styles.section}>
              <div className={styles.sectionTitle}>1. Trial Metadata</div>
              <div className={styles.grid2}>
                 <div className={styles.inputGroup}>
                   <label className={styles.label}>Trial ID</label>
                   <input className={styles.input} type="text" name="trial_id" value={formData.trial_id} onChange={handleChange} required />
                 </div>
                 <div className={styles.inputGroup}>
                   <label className={styles.label}>Site ID</label>
                   <input className={styles.input} type="text" name="site_id" value={formData.site_id} onChange={handleChange} required />
                 </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>2. Vitals & Biometrics</div>
              <div className={styles.grid3}>
                <div className={styles.inputGroup}>
                   <label className={styles.label}>Age</label>
                   <input className={styles.input} type="number" name="age" value={formData.age} onChange={handleChange} required />
                 </div>
                 <div className={styles.inputGroup}>
                   <label className={styles.label}>Systolic BP</label>
                   <input className={styles.input} type="number" name="bp_systolic" value={formData.bp_systolic} onChange={handleChange} required />
                 </div>
                 <div className={styles.inputGroup}>
                   <label className={styles.label}>Diastolic BP</label>
                   <input className={styles.input} type="number" name="bp_diastolic" value={formData.bp_diastolic} onChange={handleChange} required />
                 </div>
                 <div className={styles.inputGroup}>
                   <label className={styles.label}>Heart Rate</label>
                   <input className={styles.input} type="number" name="hr" value={formData.hr} onChange={handleChange} required />
                 </div>
                 <div className={styles.inputGroup}>
                   <label className={styles.label}>SpO2 (%)</label>
                   <input className={styles.input} type="number" name="spo2" value={formData.spo2} onChange={handleChange} required />
                 </div>
                 <div className={styles.inputGroup}>
                   <label className={styles.label}>Glucose</label>
                   <input className={styles.input} type="number" name="glucose" value={formData.glucose} onChange={handleChange} required />
                 </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>3. Clinical Context</div>
              <div className={styles.grid2}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Diagnosis</label>
                  <select 
                    className={styles.input} 
                    name="diagnosis_encoded" 
                    value={formData.diagnosis_encoded} 
                    onChange={handleChange}
                  >
                    <option value={0}>COPD</option>
                    <option value={1}>Diabetes</option>
                    <option value={2}>Hypertension</option>
                    <option value={3}>Tachycardia</option>
                    <option value={4}>None / Healthy (Control)</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                   <label className={styles.label}>Previous Trials</label>
                   <input className={styles.input} type="number" name="previous_trials" value={formData.previous_trials} onChange={handleChange} required />
                 </div>
                 <div className={styles.inputGroup}>
                  <label className={styles.label}>Product Experience</label>
                  <select className={styles.input} name="product_experience" value={formData.product_experience} onChange={handleChange}>
                    <option value={0}>No</option>
                    <option value={1}>Yes</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Last Trial Outcome</label>
                  <select className={styles.input} name="last_trial_outcome" value={formData.last_trial_outcome} onChange={handleChange}>
                    <option value={0}>Failed / Adverse</option>
                    <option value={1}>Efficacy Demonstrated</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>4. Computed Fields (Auto)</div>
              <div className={styles.grid3}>
                 <div className={styles.inputGroup}>
                   <label className={styles.label}>Health Risk Score</label>
                   <input className={styles.input} type="number" value={computed.health_risk_score} disabled />
                 </div>
                 <div className={styles.inputGroup}>
                   <label className={styles.label}>Adult Flag (18-59)</label>
                   <input className={styles.input} type="number" value={computed.age_grp_adult} disabled />
                 </div>
                 <div className={styles.inputGroup}>
                   <label className={styles.label}>Elderly Flag (60+)</label>
                   <input className={styles.input} type="number" value={computed.age_grp_elderly} disabled />
                 </div>
              </div>
            </div>

            {error && <div style={{ color: 'var(--accent-red)', marginBottom: 16 }}>{error}</div>}
            
            <button className={styles.submitBtn} type="submit" disabled={loading}>
              {loading ? 'Analyzing Data & Anchoring to Polygon...' : 'Run Integrity Check'}
            </button>
          </form>
        </div>

        <div>
          <div className={styles.previewPanel}>
            <div className={styles.previewTitle}>Live Vitals Preview</div>
            
            <div className={`${styles.previewItem} ${getVitalClass(formData.bp_systolic, 100, 130, 90, 140)}`}>
              <span className={styles.previewLabel}>Systolic BP</span>
              <span className={styles.previewVal}>{formData.bp_systolic} mmHg</span>
            </div>
            <div className={`${styles.previewItem} ${getVitalClass(formData.bp_diastolic, 70, 85, 60, 90)}`}>
              <span className={styles.previewLabel}>Diastolic BP</span>
              <span className={styles.previewVal}>{formData.bp_diastolic} mmHg</span>
            </div>
            <div className={`${styles.previewItem} ${getVitalClass(formData.hr, 60, 90, 50, 100)}`}>
              <span className={styles.previewLabel}>Heart Rate</span>
              <span className={styles.previewVal}>{formData.hr} bpm</span>
            </div>
            <div className={`${styles.previewItem} ${getVitalClass(formData.spo2, 97, 100, 95, 100)}`}>
              <span className={styles.previewLabel}>Oxygen (SpO2)</span>
              <span className={styles.previewVal}>{formData.spo2} %</span>
            </div>
            <div className={`${styles.previewItem} ${getVitalClass(formData.glucose, 80, 120, 70, 140)}`}>
              <span className={styles.previewLabel}>Glucose</span>
              <span className={styles.previewVal}>{formData.glucose} mg/dL</span>
            </div>
            
            <div style={{ marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
              <div className={`${styles.previewItem} ${computed.health_risk_score > 3.0 ? styles.previewItemDanger : (computed.health_risk_score > 1.0 ? styles.previewItemWarning : styles.previewItemNormal)}`}>
                <span className={styles.previewLabel}>Computed Risk Score</span>
                <span className={styles.previewVal}>{computed.health_risk_score}</span>
              </div>
            </div>
          </div>

          <ResultCard result={result} recordData={{...formData, ...computed}} />
        </div>
      </div>
    </div>
  );
}
