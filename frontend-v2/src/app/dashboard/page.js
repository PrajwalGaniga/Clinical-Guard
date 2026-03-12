'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Chart from '../../components/Chart';
import api from '../../api';
import styles from './page.module.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isDemo = typeof window !== 'undefined' && sessionStorage.getItem('clinicalguard_demo') === 'true';

  useEffect(() => {
    const fetchStats = async () => {
      if (isDemo) {
        // Generate realistic demo data complying with specific instructions
        const demoData = {
          total: 45,
          authentic: 40,
          manipulated: 4,
          pending: 1,
          integrity_score: 88.8,
          daily_stats: {},
          site_stats: {
            "SITE_001": { total: 30, authentic: 30, manipulated: 0 },
            "SITE_002": { total: 15, authentic: 10, manipulated: 4, pending: 1 }
          },
          recent_alerts: [
            {
              site_id: "SITE_002",
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              risk_level: "HIGH",
              data_hash: "a8f5c9d2e1b4a67f0c3d9e8b7a6f5c4d2e1b0a9f"
            }
          ]
        };
        
        // Generate 14 days of small numbers
        for (let i = 13; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          demoData.daily_stats[dateStr] = {
            total: Math.floor(Math.random() * 5) + 1,
            authentic: Math.floor(Math.random() * 4) + 1,
            manipulated: i === 2 || i === 7 ? 1 : 0
          };
        }
        
        setData(demoData);
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/dashboard/stats');
        setData(res.data);
      } catch (err) {
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isDemo]);

  if (loading) {
    return (
      <div>
        <div className={styles.header}><div className={styles.title}>Dashboard Overview</div></div>
        <div className={styles.skeletonStrip}>
          {[1,2,3,4].map(i => <div key={i} className={styles.skeletonBox}></div>)}
        </div>
        <div className={styles.chartRow}>
           <div className={styles.skeletonBox} style={{height: '300px'}}></div>
           <div className={styles.skeletonBox} style={{height: '300px'}}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className={styles.header}><div className={styles.title}>Dashboard Overview</div></div>
        <div style={{ color: 'var(--accent-red)' }}>{error}</div>
        <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: 10, background: 'var(--accent-blue)', color: 'white', borderRadius: 8 }}>Retry</button>
      </div>
    );
  }

  if (!data) return null;

  // Chart configuration defaults
  const commonOptions = {
    chart: { 
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false },
      background: 'transparent',
    },
    theme: { mode: 'dark' },
    grid: { borderColor: '#2D3748', strokeDashArray: 4 },
    dataLabels: { enabled: false }
  };

  // 14-day Area Chart Setup
  const dates = Object.keys(data.daily_stats || {}).slice(-14);
  const authenticSeries = dates.map(d => data.daily_stats[d].authentic || 0);
  const manipulatedSeries = dates.map(d => data.daily_stats[d].manipulated || 0);

  const areaOptions = {
    ...commonOptions,
    chart: { ...commonOptions.chart, type: 'area' },
    colors: ['#14B8A6', '#EF4444'],
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100]} },
    xaxis: { categories: dates, labels: { style: { colors: '#9CA3AF' } } },
    yaxis: { labels: { style: { colors: '#9CA3AF' } } },
    tooltip: { theme: 'dark' },
    legend: { show: false }
  };

  const areaSeries = [
    { name: 'Authentic', data: authenticSeries },
    { name: 'Flagged', data: manipulatedSeries }
  ];

  // Donut Chart Setup
  const donutOptions = {
    ...commonOptions,
    chart: { ...commonOptions.chart, type: 'donut' },
    colors: ['#14B8A6', '#EF4444', '#F59E0B'],
    labels: ['Authentic', 'Manipulated', 'Pending'],
    plotOptions: { pie: { donut: { size: '75%' } } },
    stroke: { show: true, colors: ['#1A1F2E'], width: 2 },
    legend: { show: false }
  };
  const donutSeries = [data.authentic, data.manipulated, data.pending];

  // Bar Chart (Sites)
  const siteKeys = Object.keys(data.site_stats || {});
  const siteScores = siteKeys.map(k => {
    const s = data.site_stats[k];
    if (s.total === 0) return 0;
    return Math.round((s.authentic / s.total) * 100);
  });

  const barOptions = {
    ...commonOptions,
    chart: { ...commonOptions.chart, type: 'bar' },
    colors: ['#3B82F6'],
    plotOptions: { bar: { borderRadius: 4, horizontal: false, columnWidth: '40%' } },
    xaxis: { categories: siteKeys, labels: { style: { colors: '#9CA3AF' } } },
    yaxis: { max: 100, labels: { style: { colors: '#9CA3AF' } } }
  };
  const barSeries = [{ name: 'Integrity %', data: siteScores }];

  const timeAgo = (dateStr) => {
    const min = Math.floor((new Date() - new Date(dateStr)) / 60000);
    if (min < 60) return `${min}m ago`;
    return `${Math.floor(min/60)}h ago`;
  };

  // Safe formatting
  const integrityScoreFormatted = typeof data.integrity_score === 'number' 
    ? data.integrity_score.toFixed(1) + '%' 
    : '0%';

  return (
    <>
      <div className={styles.header}>
        <div className={styles.title}>Dashboard Overview</div>
      </div>

      <div className={styles.statsStrip}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Records</div>
          <div className={styles.statValue}>{data.total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Authentic</div>
          <div className={styles.statValue} style={{ color: 'var(--accent-teal)' }}>{data.authentic}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Manipulated</div>
          <div className={styles.statValue} style={{ color: 'var(--accent-red)' }}>{data.manipulated}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Integrity Score</div>
          <div className={styles.statValue} style={{ color: 'var(--accent-blue)' }}>{integrityScoreFormatted}</div>
        </div>
      </div>

      <div className={styles.chartRow}>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>14-Day Integrity Trend (Authentic vs Flagged)</div>
          <Chart options={areaOptions} series={areaSeries} type="area" height={220} width="100%" />
        </div>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Record Composition</div>
          <Chart options={donutOptions} series={donutSeries} type="donut" height={220} width="100%" />
        </div>
      </div>

      <div className={styles.bottomRow}>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Site Integrity Scores (%)</div>
          <Chart options={barOptions} series={barSeries} type="bar" height={220} width="100%" />
        </div>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Recent Critical Alerts</div>
          <div className={styles.alertsList}>
            {data.recent_alerts && data.recent_alerts.slice(0, 5).map((alert, idx) => (
              <div key={idx} className={styles.alertItem}>
                <div className={styles.alertInfo}>
                  <span className={styles.alertSite}>{alert.site_id}</span>
                  <span className={styles.alertHash}>Tx: {alert.data_hash?.substring(0, 16) || '—'}...</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span className={`${styles.badge} ${styles.badgeHigh}`}>{alert.risk_level}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{timeAgo(alert.timestamp)}</span>
                </div>
              </div>
            ))}
            {(!data.recent_alerts || data.recent_alerts.length === 0) && (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', margin: '40px 0' }}>
                No recent alerts found.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
