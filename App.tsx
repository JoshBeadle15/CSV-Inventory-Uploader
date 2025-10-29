import React, { useState } from 'react';
import Header from './components/Header';
import Uploader from './components/Uploader';
import Settings from './components/Settings';

type Page = 'uploader' | 'settings';

const App: React.FC = () => {
  const [page, setPage] = useState<Page>('uploader');

  // Load initial config from localStorage
  const [shopifyStore, setShopifyStore] = useState<string>(() => localStorage.getItem('shopifyStore') || '');
  const [shopifyToken, setShopifyToken] = useState<string>(() => localStorage.getItem('shopifyToken') || '');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => localStorage.getItem('isDemoMode') === 'true');

  const handleSaveSettings = (store: string, token: string, demoMode: boolean) => {
    // Save to localStorage and update state
    localStorage.setItem('shopifyStore', store);
    localStorage.setItem('shopifyToken', token);
    localStorage.setItem('isDemoMode', String(demoMode));
    setShopifyStore(store);
    setShopifyToken(token);
    setIsDemoMode(demoMode);
    setPage('uploader'); // Navigate back to the main page
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-brand-dark text-gray-800 dark:text-gray-200 font-sans">
      <Header onNavigateSettings={() => setPage('settings')} isDemoMode={isDemoMode} />
      <main className="container mx-auto p-4 md:p-8">
        {page === 'uploader' && (
          <Uploader 
            shopifyStore={shopifyStore}
            shopifyToken={shopifyToken}
            isDemoMode={isDemoMode}
            onNavigateSettings={() => setPage('settings')}
          />
        )}
        {page === 'settings' && (
          <Settings 
            initialStore={shopifyStore}
            initialToken={shopifyToken}
            initialDemoMode={isDemoMode}
            onSave={handleSaveSettings}
            onCancel={() => setPage('uploader')}
          />
        )}
      </main>
    </div>
  );
};

export default App;