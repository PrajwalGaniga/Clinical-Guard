// Generate realistic fake data for the last 14 days
const generateDailyData = () => {
  const data = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Simulate some realistic traffic
    const baseAuthentic = Math.floor(Math.random() * 50) + 20;
    const baseFlagged = Math.random() > 0.7 ? Math.floor(Math.random() * 5) + 1 : 0;
    
    data.push({ date: dateStr, authentic: baseAuthentic, flagged: baseFlagged });
  }
  return data;
};

export const DEMO_STATS = {
  total: 485,
  authentic: 452,
  manipulated: 28,
  pending: 5,
  authentic_pct: 93.2,
  manipulated_pct: 5.8,
  daily_data: generateDailyData(),
  site_stats: [
    { site: 'SITE_001', score: 98 },
    { site: 'SITE_NY2', score: 85 },
    { site: 'SITE_LDN', score: 92 },
    { site: 'SITE_SF4', score: 78 },
    { site: 'SITE_TKY', score: 100 }
  ],
  recent_alerts: [
    { record_id: 'REC_998', site_id: 'SITE_SF4', risk_level: 'HIGH', decision: 'MANIPULATED', submitted_at: new Date().toISOString() },
    { record_id: 'REC_842', site_id: 'SITE_NY2', risk_level: 'MEDIUM', decision: 'MANIPULATED', submitted_at: new Date(Date.now() - 3600000).toISOString() },
    { record_id: 'REC_731', site_id: 'SITE_SF4', risk_level: 'HIGH', decision: 'MANIPULATED', submitted_at: new Date(Date.now() - 7200000).toISOString() }
  ]
};

export const DEMO_PREDICT = {
  decision: 'MANIPULATED',
  integrity_label: 0,
  confidence_authentic: 0.09,
  confidence_manipulated: 99.91,
  risk_level: 'HIGH',
  blockchain_action: 'REJECT_TRANSACTION',
  data_hash: 'e96afe7a4799c8a0c8b4f2d3e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2',
  tx_hash: '0xSTUB_demo_abc123def456',
  gemini_reasoning: 'This record demonstrates a classic Value Substitution Manipulation pattern. The diastolic BP of 95 mmHg combined with a Health Risk Score of 0.74 significantly deviates from the authentic population baseline. The combination of elevated glucose (190 mg/dL) with a low SpO2 reading suggests systematic alteration of multiple correlated fields. Immediate rejection and clinical audit are recommended.',
  sfo_override: false
};
