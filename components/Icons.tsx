import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

// 蜗牛图标 - 慢速播放
export const SnailIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    {/* 蜗牛壳 - 螺旋形 */}
    <circle cx="14" cy="12" r="5.5" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <circle cx="14" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
    {/* 蜗牛身体 */}
    <path d="M8 15 C7 15, 6 14.5, 6 13.5 L6 12 C6 11, 7 10.5, 8 10.5 L9 10.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* 触角 */}
    <line x1="6.5" y1="11" x2="6.5" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="6.5" cy="7.5" r="1" fill="currentColor" />
    <line x1="8.5" y1="11" x2="8.5" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
  </svg>
);

// 喇叭图标 - 正常速度播放
export const SpeakerIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    {/* 扬声器主体 */}
    <path d="M9 8 L9 16 L5 16 C4.5 16 4 15.5 4 15 L4 9 C4 8.5 4.5 8 5 8 Z" fill="currentColor" />
    {/* 扬声器锥形 */}
    <path d="M9 8 L15 4 L15 20 L9 16 Z" fill="currentColor" />
    {/* 声波 - 第一层 */}
    <path d="M17 10 C17.5 10.5 18 11.2 18 12 C18 12.8 17.5 13.5 17 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* 声波 - 第二层 */}
    <path d="M19 8 C20 9 20.5 10.3 20.5 12 C20.5 13.7 20 15 19 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </svg>
);

// 麦克风图标 - 录音
export const MicrophoneIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
    <rect x="7" y="3" width="6" height="9" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M4 10 Q4 15, 10 16 Q16 15, 16 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <line x1="10" y1="16" x2="10" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="7" y1="19" x2="13" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 波形图标 - 分析
export const WaveformIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
    <rect x="3" y="6" width="3" height="8" rx="1.5" fill="currentColor" />
    <rect x="8.5" y="3" width="3" height="14" rx="1.5" fill="currentColor" />
    <rect x="14" y="7" width="3" height="6" rx="1.5" fill="currentColor" />
  </svg>
);
