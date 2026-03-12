import styles from './RiskBadge.module.css';

export default function RiskBadge({ level }) {
  if (!level) return null;
  const v = level.toUpperCase();
  
  let type = '';
  if (v === 'HIGH' || v === 'MANIPULATED') type = styles.red;
  else if (v === 'LOW' || v === 'AUTHENTIC') type = styles.teal;
  else if (v === 'MEDIUM') type = styles.orange;
  
  return (
    <span className={`${styles.badge} ${type}`}>
      {v}
    </span>
  );
}
