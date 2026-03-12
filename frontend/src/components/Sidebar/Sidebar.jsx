import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const role = user?.role || '';

  const navItems = [
    { label: 'Dashboard',    path: '/dashboard', icon: '⬡',  roles: ['admin', 'investigator', 'monitor', 'regulator'] },
    { label: 'Single Check', path: '/check',     icon: '🔬', roles: ['admin', 'investigator'] },
    { label: 'Batch Upload', path: '/upload',    icon: '📁', roles: ['admin', 'investigator'] },
    { label: 'Results',      path: '/results',   icon: '📋', roles: ['admin', 'investigator', 'monitor', 'regulator'] },
    { label: 'Audit Log',    path: '/audit',     icon: '🔒', roles: ['admin', 'monitor', 'regulator'] },
  ];

  const filteredNav = navItems.filter(i => i.roles.includes(role));

  const triggerMentorAI = () => {
    window.dispatchEvent(new CustomEvent('openMentor'));
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.logo}>✦</div>
        <span className={styles.brandName}>ClinicalGuard</span>
      </div>

      <nav className={styles.nav}>
        {filteredNav.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.icon}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <button className={styles.navLink} onClick={triggerMentorAI}>
          <span className={styles.icon}>🤖</span> Mentor AI
        </button>
      </nav>

      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{user?.name}</div>
          <div className={styles.userRole}>{user?.role}</div>
        </div>
        <button className={styles.logoutBtn} onClick={logout}>
          Logout ⎋
        </button>
      </div>
    </aside>
  );
}
