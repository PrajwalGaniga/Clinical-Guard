'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import styles from './Sidebar.module.css';

const navLinks = [
  { name: 'Dashboard', path: '/dashboard', roles: ['admin', 'investigator', 'monitor', 'regulator'] },
  { name: 'Single Check', path: '/check', roles: ['admin', 'investigator'] },
  { name: 'Batch Upload', path: '/upload', roles: ['admin', 'investigator'] },
  { name: 'Results Database', path: '/results', roles: ['admin', 'investigator', 'monitor', 'regulator'] },
  { name: 'Audit Log', path: '/audit', roles: ['admin', 'monitor', 'regulator'] }
];

export default function Sidebar({ onOpenMentor }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const visibleLinks = navLinks.filter(link => link.roles.includes(user.role));

  const initials = user.email ? user.email.substring(0, 2).toUpperCase() : 'U';

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoArea}>
        <div className={styles.logoTitle}>ClinicalGuard</div>
        <div className={styles.logoSubtitle}>Data Integrity Platform</div>
      </div>

      <nav className={styles.nav}>
        {visibleLinks.map((link) => {
          const isActive = pathname === link.path || pathname.startsWith(`${link.path}/`);
          return (
            <Link 
              key={link.path} 
              href={link.path}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              {link.name}
            </Link>
          );
        })}
      </nav>

      <button className={`${styles.navItem} ${styles.mentorItem}`} onClick={onOpenMentor}>
        🤖 Mentor AI
      </button>

      <div className={styles.userProfile}>
        <div className={styles.avatar}>{initials}</div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{user.email.split('@')[0]}</div>
          <div className={styles.userRole}>{user.role}</div>
        </div>
      </div>
      
      <button className={styles.logoutBtn} onClick={logout}>
        Logout
      </button>
    </aside>
  );
}
