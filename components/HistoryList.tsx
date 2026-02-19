
import React, { useState, useMemo } from 'react';
import { HistoryItem } from '../types';

interface HistoryListProps {
  history: HistoryItem[];
  onSelect: (text: string) => void;
  onClear: () => void;
}

const SearchIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

export const HistoryList: React.FC<HistoryListProps> = ({ history, onSelect, onClear }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    return history.filter(item => 
      item.text.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [history, searchTerm]);

  if (history.length === 0) return null;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-black text-indigo-600 uppercase tracking-[0.15em]">Recent Practice</h3>
        <button
          onClick={onClear}
          className="text-[10px] font-extrabold text-slate-400 hover:text-red-500 uppercase tracking-[0.12em] transition-colors"
        >
          Clear All
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <SearchIcon className="text-slate-300 w-4 h-4" />
        </div>
        <input
          type="text"
          placeholder="Search history..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-4 py-3.5 border-[1.5px] border-slate-200 rounded-[16px] bg-white text-[12px] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 focus:bg-white transition-all placeholder:text-slate-400 shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {filteredHistory.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.text)}
            className={`group w-full text-left p-5 rounded-[20px] shadow-md hover:shadow-lg transition-all flex items-center gap-4 active:scale-[0.98] ${
              item.score >= 80
                ? 'bg-gradient-to-br from-white to-emerald-50 border-[1.5px] border-emerald-300/60 hover:border-emerald-400'
                : item.score >= 60
                ? 'bg-gradient-to-br from-white to-indigo-50 border-[1.5px] border-indigo-200 hover:border-indigo-300'
                : 'bg-gradient-to-br from-white to-orange-50 border-[1.5px] border-orange-200 hover:border-orange-300'
            }`}
          >
            <div className={`w-[52px] h-[52px] shrink-0 rounded-full flex items-center justify-center font-black text-[16px] shadow-sm border-2 ${
                item.score >= 80 ? 'bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700 border-emerald-400' :
                item.score >= 60 ? 'bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-700 border-indigo-400' :
                'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-700 border-orange-400'
            }`}>
              {item.score > 0 ? item.score : "-"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-700 font-bold text-[13px] truncate pr-2">{item.text}</p>
              <p className="text-[9px] text-slate-400 uppercase font-bold mt-1 flex items-center gap-2 tracking-wider">
                {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                {new Date(item.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-1">
               <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
