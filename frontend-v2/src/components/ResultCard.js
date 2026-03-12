'use client';

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import styles from './ResultCard.module.css';

export default function ResultCard({ result, recordData }) {
  if (!result) return null;

  const mlData = result.ml_result || result;
  const isHighRisk = mlData.risk_level === 'HIGH';
  const confidenceAuth = (Math.min(mlData.confidence_authentic || 0, 100)).toFixed(1);
  const confidenceMan = (Math.min(mlData.confidence_manipulated || 0, 100)).toFixed(1);
  const finalVerdict = result.verdict || mlData.decision || 'UNKNOWN';
  const riskLvl = mlData.risk_level || 'UNKNOWN';

  const getBadgeClass = (level) => {
    switch (level) {
      case 'HIGH': return styles.badgeHigh;
      case 'MEDIUM': return styles.badgeMedium;
      case 'LOW': return styles.badgeLow;
      default: return styles.badgeMedium;
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const isAuthentic = finalVerdict.toUpperCase() === 'AUTHENTIC';
    const primaryColor = isAuthentic ? [20, 184, 166] : [239, 68, 68];
    const textColor = [200, 200, 200];
    
    // Helper to draw dark background for all pages
    const applyDarkBg = () => {
      doc.setFillColor(15, 17, 23); // #0F1117
      doc.rect(0, 0, 210, 297, 'F');
    };

    // ------------- PAGE 1: COVER -------------
    applyDarkBg();
    
    // Logo & Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text("ClinicalGuard", 105, 60, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(150, 150, 150);
    doc.text("Data Integrity Platform", 105, 70, { align: "center" });

    // Report Details
    doc.setFontSize(12);
    doc.setTextColor(200, 200, 200);
    doc.text(`Report ID: RPT-${Date.now().toString().slice(-6)}`, 105, 120, { align: "center" });
    doc.text(`Trial ID: ${recordData.trial_id || 'N/A'}`, 105, 130, { align: "center" });
    doc.text(`Site ID: ${recordData.site_id || 'N/A'}`, 105, 140, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 150, { align: "center" });

    // Verdict Box
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(55, 180, 100, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(finalVerdict.toUpperCase(), 105, 205, { align: "center" });

    // ------------- PAGE 2: PATIENT RECORD -------------
    doc.addPage();
    applyDarkBg();
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("Patient Record Details", 14, 20);

    const tableData = [
      ['age', recordData.age, '18-80'],
      ['bp_systolic', recordData.bp_systolic, '90-140'],
      ['bp_diastolic', recordData.bp_diastolic, '60-90'],
      ['glucose', recordData.glucose, '70-140'],
      ['hr', recordData.hr, '60-100'],
      ['spo2', recordData.spo2, '95-100'],
      ['health_risk_score', recordData.health_risk_score, '0.1-5.0'],
      ['age_grp_adult', recordData.age_grp_adult, '0 or 1'],
      ['age_grp_elderly', recordData.age_grp_elderly, '0 or 1'],
      ['diagnosis_numeric', recordData.diagnosis_numeric, '0-4'],
      ['previous_trials', recordData.previous_trials, '0+'],
      ['product_experience', recordData.product_experience, '0 or 1'],
      ['last_trial_outcome', recordData.last_trial_outcome, '0 or 1'],
    ];

    doc.autoTable({
      startY: 30,
      head: [['Feature', 'Value', 'Normal Range']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [26, 31, 46], textColor: [255, 255, 255] },
      bodyStyles: { fillColor: [15, 17, 23], textColor: [200, 200, 200] },
      alternateRowStyles: { fillColor: [20, 24, 36] },
      styles: { lineColor: [45, 55, 72], lineWidth: 0.1 }
    });

    // ------------- PAGE 3: ML VERDICT -------------
    doc.addPage();
    applyDarkBg();
    doc.setTextColor(255, 255, 255);
    doc.text("Machine Learning Analysis & Blockchain", 14, 20);

    const mlDataArr = [
      ['Final Decision', finalVerdict],
      ['Risk Level', riskLvl],
      ['Authentic Probability', `${confidenceAuth}%`],
      ['Manipulated Probability', `${confidenceMan}%`],
      ['SFO Flag Triggered', result.metadata?.sfo_detected ? 'YES' : 'NO'],
      ['Blockchain Action', result.metadata?.blockchain_status || 'PENDING'],
      ['Data SHA-256 Hash', result.data_hash || result.blockchain?.data_hash || 'N/A'],
      ['Transaction Hash', result.metadata?.blockchain_tx || result.blockchain?.tx_hash || 'N/A']
    ];

    doc.autoTable({
      startY: 30,
      body: mlDataArr,
      theme: 'grid',
      bodyStyles: { fillColor: [15, 17, 23], textColor: [200, 200, 200] },
      alternateRowStyles: { fillColor: [20, 24, 36] },
      styles: { lineColor: [45, 55, 72], lineWidth: 0.1 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } }
    });

    // ------------- PAGE 4: GEMINI REASONING -------------
    doc.addPage();
    applyDarkBg();
    doc.setTextColor(139, 92, 246); // Purple
    doc.text("✦ Gemini AI Reasoning", 14, 20);

    doc.setTextColor(200, 200, 200);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    
    const splitText = doc.splitTextToSize(result.reasoning || 'No AI reasoning available.', 180);
    doc.text(splitText, 14, 35);

    // Disclaimer
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Disclaimer: This report is generated automatically by the ClinicalGuard ML/AI systems.", 14, 280);

    doc.save(`ClinicalGuard_Report_${Date.now()}.pdf`);
  };

  return (
    <div className={`${styles.card} ${isHighRisk ? styles.pulsingHighRisk : ''}`}>
      <div className={styles.topSection}>
        <div className={styles.verdictArea}>
          <div className={styles.label}>Final Verdict</div>
          <div className={`${styles.verdictValue} ${finalVerdict.toUpperCase() === 'AUTHENTIC' ? styles.verdictAuthentic : styles.verdictManipulated}`}>
            {finalVerdict.toUpperCase()}
          </div>
          <div className={`${styles.badge} ${getBadgeClass(riskLvl)}`}>
            {riskLvl} RISK
          </div>
        </div>
        <button className={styles.downloadBtn} onClick={handleDownloadPDF}>
          📄 Download PDF Report
        </button>
      </div>

      <div className={styles.confidenceBars}>
        <div className={styles.barGroup}>
          <span className={styles.barLabel}>Authentic</span>
          <div className={styles.barBg}>
            <div className={styles.barFill} style={{ width: `${Math.min(confidenceAuth, 100)}%`, backgroundColor: 'var(--accent-teal)' }}></div>
          </div>
          <span className={styles.valPercent}>{confidenceAuth}%</span>
        </div>
        <div className={styles.barGroup}>
          <span className={styles.barLabel}>Manipulated</span>
          <div className={styles.barBg}>
            <div className={styles.barFill} style={{ width: `${Math.min(confidenceMan, 100)}%`, backgroundColor: 'var(--accent-red)' }}></div>
          </div>
          <span className={styles.valPercent}>{confidenceMan}%</span>
        </div>
      </div>

      <div className={styles.label} style={{ marginBottom: 6 }}>SHA-256 Data Fingerprint</div>
      <div className={styles.hashBox}>
        <span className={styles.hashVal}>{result.data_hash}</span>
      </div>

      <div className={styles.geminiBox}>
        <div className={styles.geminiTitle}>✦ Gemini AI Reasoning</div>
        <div className={styles.geminiText}>{result.reasoning}</div>
      </div>

      <div className={styles.footerInfo}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div>SFO Detection: {result.metadata?.sfo_detected ? 'Triggered' : 'Clean'}</div>
          <div>Blockchain: {result.metadata?.blockchain_status || 'Anchored on Polygon'}</div>
        </div>
        <button 
          className={styles.downloadBtn} 
          style={{ padding: '4px 12px', fontSize: '12px', background: 'var(--accent-purple)' }}
          onClick={() => {
            window.dispatchEvent(new CustomEvent('setMentorContext', { 
              detail: { record_id: result.data_hash } 
            }));
            // Just dispatching this will set the context, but we also want it to open if it's closed.
            // The user will have to click the global FAB if it's not open, but this ensures context is loaded.
          }}
        >
          ✦ Ask AI
        </button>
      </div>
    </div>
  );
}
