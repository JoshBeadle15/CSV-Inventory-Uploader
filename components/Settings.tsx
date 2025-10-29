import React, { useState } from 'react';
import { KeyIcon, SaveIcon } from './Icons';

interface SettingsProps {
  initialStore: string;
  initialToken: string;
  initialDemoMode: boolean;
  onSave: (store: string, token: string, demoMode: boolean) => void;
  onCancel: () => void;
}

const Settings: React.FC<SettingsProps> = ({ initialStore, initialToken, initialDemoMode, onSave, onCancel }) => {
  const [store, setStore] = useState(initialStore);
  const [token, setToken] = useState(initialToken);
  const [demoMode, setDemoMode] = useState(initialDemoMode);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    if(demoMode || (store.trim() && token.trim())){
      onSave(store, token, demoMode);
    } else {
      setError("Both Store Name and Access Token are required unless Demo Mode is enabled.");
    }
  };

  return (
    <div className="text-center max-w-lg mx-auto animate-fade-in">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <KeyIcon className="h-16 w-16 mx-auto text-brand-primary dark:text-brand-light" />
        <h2 className="text-2xl font-bold text-brand-primary dark:text-brand-light mt-4">Shopify API Configuration</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Enter your Shopify store name and Admin API access token to connect your store.
        </p>
        <div className="mt-6 space-y-4 text-left">
          <fieldset className="space-y-4 disabled:opacity-50" disabled={demoMode}>
            <div>
              <label htmlFor="store-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Shopify Store Name</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input 
                  type="text" 
                  id="store-name"
                  className="block w-full pr-32 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-brand-secondary focus:border-brand-secondary disabled:bg-gray-200 dark:disabled:bg-gray-700"
                  placeholder="your-store-name"
                  value={store}
                  onChange={(e) => setStore(e.target.value.replace('.myshopify.com', ''))}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">.myshopify.com</span>
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="api-token" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Admin API Access Token</label>
              <input 
                type="password" 
                id="api-token"
                className="mt-1 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-brand-secondary focus:border-brand-secondary disabled:bg-gray-200 dark:disabled:bg-gray-700"
                placeholder="shpat_xxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
          </fieldset>
           <div className="relative flex items-start pt-4">
            <div className="flex items-center h-5">
              <input
                id="demo-mode"
                name="demo-mode"
                type="checkbox"
                className="focus:ring-brand-secondary h-4 w-4 text-brand-secondary border-gray-300 rounded"
                checked={demoMode}
                onChange={(e) => setDemoMode(e.target.checked)}
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="demo-mode" className="font-medium text-gray-700 dark:text-gray-300">
                Enable Demo Mode
              </label>
              <p className="text-gray-500 dark:text-gray-400">Use the app without real Shopify credentials for testing.</p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <button onClick={onCancel} className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg shadow-sm transition-all duration-300 ease-in-out">
            Cancel
          </button>
          <button onClick={handleSave} className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-brand-primary hover:bg-brand-dark text-white font-semibold rounded-lg shadow-md transition-all duration-300 ease-in-out">
            <SaveIcon className="h-5 w-5" />
            Save Settings
          </button>
        </div>
        {error && <p className="text-red-500 mt-4 bg-red-100 dark:bg-red-900/50 p-3 rounded-lg">{error}</p>}
        <div className="mt-6 text-left text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 p-3 rounded-lg">
          <p><strong className="font-semibold">Note:</strong> Your token needs <code className="text-xs">write_products</code> permission. Your credentials are saved in your browser's local storage and are not sent anywhere except directly to Shopify.</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;