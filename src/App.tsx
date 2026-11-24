import { useEffect, useState } from 'react';
import { AdminPortalPage } from './components/AdminPortalPage';
import { StudentVotingPage } from './components/StudentVotingPage';

function getCurrentRoute(): 'public' | 'admin' {
  if (typeof window === 'undefined') return 'public';
  return window.location.pathname.startsWith('/admin') ? 'admin' : 'public';
}

export default function App() {
  const [route, setRoute] = useState<'public' | 'admin'>(getCurrentRoute);

  useEffect(() => {
    const handlePop = () => {
      setRoute(getCurrentRoute());
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  function navigateTo(target: 'public' | 'admin') {
    const nextPath = target === 'admin' ? '/admin' : '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
    setRoute(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (route === 'admin') {
    return <AdminPortalPage onNavigatePublic={() => navigateTo('public')} />;
  }

  return <StudentVotingPage onNavigateAdmin={() => navigateTo('admin')} />;
}
