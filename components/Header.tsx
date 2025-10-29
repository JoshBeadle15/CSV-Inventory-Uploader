import React from 'react';
import { AimsiiLogo, CogIcon } from './Icons';

interface HeaderProps {
    onNavigateSettings: () => void;
    isDemoMode: boolean;
}

const Header: React.FC<HeaderProps> = ({ onNavigateSettings, isDemoMode }) => {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <AimsiiLogo className="h-8 w-auto text-brand-primary dark:text-brand-light" />
              <span className="text-xl font-bold text-gray-800 dark:text-gray-200 tracking-tight">
                AIMSii CSV to Shopify Uploader
              </span>
            </div>
             {isDemoMode && (
              <span className="bg-brand-accent text-white text-xs font-bold px-2 py-1 rounded-full animate-fade-in">
                DEMO MODE
              </span>
            )}
          </div>
          <div className="flex items-center">
             <button
                onClick={onNavigateSettings}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
                <CogIcon className="h-5 w-5" />
                <span>Settings</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;