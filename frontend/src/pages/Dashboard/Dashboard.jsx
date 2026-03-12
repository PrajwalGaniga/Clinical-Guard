import { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { DEMO_STATS } from '../../utils/demoData';
import RiskBadge from '../../components/RiskBadge/RiskBadge';
import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let interval;
    const fetchStats = async () => {
      if (user?.email === 'demo@clinicalguard.com') {
        setStats(DEMO_STATS);
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/dashboard/stats');
        setStats(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to connect to monitoring agent.');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    if (user?.email !== 'demo@clinicalguard.com') {
      interval = setInterval(fetchStats, 30000);
    }
    return () => clearInterval(interval);
  }, [user]);

  if (error) return <div className={styles.error}>⚠️ {error}</div>;
  if (loading || !stats) return (
    <div className={styles.skeletonGrid}>
      <div className={`skeleton ${styles.skBox} ${styles.skStrip}`}></div>
      <div className={`skeleton ${styles.skBox}`}></div>
      <div className={`skeleton ${styles.skBox}`}></div>
      <div className={`skeleton ${styles.skBox}`}></div>
      <div className={`skeleton ${styles.skBox} ${styles.skWide}`}></div>
    </div>
  );

  const getIntegrityColor = (pct) => {
    if (pct > 90) return 'var(--teal)';
    if (pct > 70) return 'var(--orange)';
    return 'var(--red)';
  };

  const areaOptions = {
    chart: { type: 'area', background: 'transparent', toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
    theme: { mode: 'dark' },
    colors: ['#14B8A6', '#EF4444'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: { categories: stats.daily_data.map(d => d.date), axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { colors: '#9CA3AF' } } },
    grid: { borderColor: '#2D3748', strokeDashArray: 4 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] } }
  };

  const donutOptions = {
    chart: { type: 'donut', background: 'transparent', fontFamily: 'Inter, sans-serif' },
    theme: { mode: 'dark' },
    labels: ['Authentic', 'Manipulated', 'Pending'],
    colors: ['#14B8A6', '#EF4444', '#F59E0B'],
    stroke: { show: true, colors: '#1A1F2E', width: 2 },
    dataLabels: { enabled: false },
    plotOptions: { pie: { donut: { size: '75%', labels: { show: true, total: { show: true, showAlways: true, label: 'Records', color: '#9CA3AF' } } } } },
    legend: { position: 'bottom' }
  };

  const barOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
    theme: { mode: 'dark' },
    colors: ['#3B82F6'],
    plotOptions: { bar: { borderRadius: 4, horizontal: true } },
    dataLabels: { enabled: false },
    xaxis: { categories: stats.site_stats.map(s => s.site), labels: { style: { colors: '#9CA3AF' } } },
    yaxis: { labels: { style: { colors: '#9CA3AF' } } },
    grid: { borderColor: '#2D3748', strokeDashArray: 4 }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>System Overview</h1>
        <p className={styles.subtitle}>Real-time clinical trial integrity monitoring</p>
      </header>

      <div className={styles.missionStrip}>
        <div className={styles.stripItem}>
          <div className={styles.sLabel}>Total Records</div>
          <div className={styles.sValue}>{stats.total}</div>
        </div>
        <div className={styles.stripItem}>
          <div className={styles.sLabel}>Authentic</div>
          <div className={styles.sValueTeal}>{stats.authentic}</div>
        </div>
        <div className={styles.stripItem}>
          <div className={styles.sLabel}>Manipulated</div>
          <div className={styles.sValueRed}>{stats.manipulated}</div>
        </div>
        <div className={styles.stripItem}>
          <div className={styles.sLabel}>Integrity</div>
          <div className={styles.sValue} style={{ color: getIntegrityColor(stats.authentic_pct) }}>{stats.authentic_pct}%</div>
        </div>
      </div>

      <div className={styles.cardsRow}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>System Integrity Index</div>
          <div className={styles.cardMain} style={{ color: getIntegrityColor(stats.authentic_pct) }}>
            {stats.authentic_pct}%
          </div>
          <div className={styles.cardSub}>Health Baseline</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Active Trial Sites</div>
          <div className={styles.cardMain}>{stats.site_stats.length}</div>
          <div className={styles.cardSubLive}><span className={styles.dot}></span> Monitoring Live</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Pending Audits</div>
          <div className={styles.cardMain}>{stats.pending}</div>
          <div className={styles.cardSub}>Action Required</div>
          <button className={styles.actionBtn} onClick={() => navigate('/results')}>Review All →</button>
        </div>
      </div>

      <div className={styles.chartsRow}>
        <div className={styles.cardWide}>
          <div className={styles.cardTitle}>14-Day Velocity Trend</div>
          <Chart options={areaOptions} series={[{ name: 'Authentic', data: stats.daily_data.map(d=>d.authentic) }, { name: 'Flagged', data: stats.daily_data.map(d=>d.flagged) }]} type="area" height={220} />
        </div>
        <div className={styles.cardNarrow}>
          <div className={styles.cardTitle}>Integrity Composition</div>
          <Chart options={donutOptions} series={[stats.authentic, stats.manipulated, stats.pending]} type="donut" height={220} />
        </div>
      </div>

      <div className={styles.chartsRowBottom}>
        <div className={styles.cardHalf}>
          <div className={styles.cardTitle}>Site Reliability Scores</div>
          <Chart options={barOptions} series={[{ name:'Score', data: stats.site_stats.map(s=>s.score) }]} type="bar" height={200} />
        </div>
        <div className={styles.cardHalf}>
          <div className={styles.cardTitle}>Recent Alerts Feed</div>
          <div className={styles.alertList}>
            {stats.recent_alerts.length === 0 ? (
              <div className={styles.alertEmpty}>No alerts — all systems normal ✓</div>
            ) : (
              stats.recent_alerts.slice(0, 5).map(a => (
                <div key={a.record_id} className={styles.alertRow}>
                  <RiskBadge level={a.risk_level} />
                  <div className={styles.alertCol}>
                    <div className={styles.alertNode}>{a.site_id} ({a.record_id})</div>
                    <div className={styles.alertTime}>{new Date(a.submitted_at).toLocaleString()}</div>
                  </div>
                  <div className={styles.alertDecision}>{a.decision}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
