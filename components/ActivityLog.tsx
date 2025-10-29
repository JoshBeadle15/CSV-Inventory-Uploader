
import React from 'react';
import { ActivityLogEntry } from '../types';
import { CheckCircleIcon, LoadingIcon, SearchIcon, ShopifyIcon, SparklesIcon, XCircleIcon } from './Icons';

interface ActivityLogProps {
  logs: ActivityLogEntry[];
}

const iconMap: Record<ActivityLogEntry['type'], React.ReactNode> = {
  POLL: <SearchIcon className="h-5 w-5 text-gray-400" />,
  DETECT: <SparklesIcon className="h-5 w-5 text-yellow-500" />,
  GENERATE: <LoadingIcon className="h-5 w-5 text-blue-500 animate-spin" />,
  CREATE: <ShopifyIcon className="h-5 w-5 text-green-500" />,
  STATUS: <CheckCircleIcon className="h-5 w-5 text-indigo-500" />,
  ERROR: <XCircleIcon className="h-5 w-5 text-red-500" />,
};

const ActivityLog: React.FC<ActivityLogProps> = ({ logs }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 h-full">
      <h3 className="text-xl font-semibold p-4 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
        Activity Log
      </h3>
      <div className="p-2">
        {logs.length === 0 ? (
            <div className="flex items-center justify-center h-96 text-gray-500 dark:text-gray-400">
                <p>Log is empty. Start monitoring to see activity.</p>
            </div>
        ) : (
            <ul className="h-[32rem] overflow-y-auto flex flex-col-reverse space-y-2 space-y-reverse pr-2">
                {logs.map(log => (
                <li key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg animate-fade-in">
                    <div className="flex-shrink-0 pt-1">{iconMap[log.type]}</div>
                    <div className="flex-1">
                        <p className="text-sm text-gray-800 dark:text-gray-200">{log.message}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{log.timestamp}</p>
                    </div>
                </li>
                ))}
            </ul>
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
