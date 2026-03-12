'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import MentorAI from './MentorAI';
import styles from './AppShell.module.css';

const PUBLIC_PATHS = ['/login', '/register'];

export default function AppShell({ children }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [mentorOpen, setMentorOpen] = useState(false);

  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p));

  // Always render public pages without the shell
  if (isPublic) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', color: 'var(--text-secondary)', fontSize: 14 }}>
        Loading session...
      </div>
    );
  }

  if (!user) return null; // AuthContext will redirect

  return (
    <div className={styles.appShell}>
      <Sidebar onOpenMentor={() => setMentorOpen(true)} />
      <main className={styles.mainContent}>
        <div className={styles.pageContainer}>
          {children}
        </div>
        <MentorAI isOpen={mentorOpen} onClose={() => setMentorOpen(false)} />
      </main>
    </div>
  );
}
