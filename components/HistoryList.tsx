
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
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Recent Practice</h3>
        <button 
          onClick={onClear}
          className="text-[9px] font-black text-slate-300 hover:text-red-500 uppercase transition-colors"
        >
          Clear All
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon className="text-slate-300 w-3.5 h-3.5" />
        </div>
        <input
          type="text"
          placeholder="Search history..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-9 pr-3 py-2 border border-slate-100 rounded-xl bg-white text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500/20 transition-all placeholder:text-slate-300 shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-2">
        {filteredHistory.map((item) => (
          <button 
            key={item.id} 
            onClick={() => onSelect(item.text)}
            className="group w-full text-left bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex items-center gap-4 active:scale-[0.98]"
          >
            <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-black text-[12px] shadow-inner ${
                item.score >= 80 ? 'bg-emerald-50 text-emerald-600' :
                item.score >= 60 ? 'bg-indigo-50 text-indigo-600' :
                'bg-orange-50 text-orange-600'
            }`}>
              {item.score > 0 ? item.score : "-"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-800 font-bold text-[13px] truncate pr-2">{item.text}</p>
              <p className="text-[8px] text-slate-400 uppercase font-black mt-0.5 flex items-center gap-2">
                {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                {new Date(item.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2">
               <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
