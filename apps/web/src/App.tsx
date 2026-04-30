import { useEffect, useState } from 'react';
import { WebSocketProvider } from './contexts/WebSocketContext.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { ClubPage } from './pages/ClubPage.tsx';
import { DjPage } from './pages/DjPage.tsx';

type Page = 'club' | 'dj' | 'auth';

function getPage(): Page {
  const path = window.location.pathname;
  if (path === '/dj') return 'dj';
  if (path === '/auth') return 'auth';
  return 'club';
}

export default function App() {
  const [page, setPage] = useState<Page>(getPage);

  useEffect(() => {
    const onPop = () => setPage(getPage());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <WebSocketProvider>
      {page === 'auth' && <AuthPage />}
      {page === 'dj' && <DjPage />}
      {page === 'club' && <ClubPage />}
    </WebSocketProvider>
  );
}
