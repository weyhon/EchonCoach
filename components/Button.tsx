
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  isLoading?: boolean;
  isPlaying?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading,
  isPlaying,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyle = "relative px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden";

  const variants = {
    primary: "bg-gradient-to-r from-[#ec6d44] to-[#f5277f] text-white hover:opacity-90",
    secondary: "bg-emerald-600 text-white hover:bg-emerald-500",
    danger: "bg-red-600 text-white hover:bg-red-500",
    outline: "border text-white hover:border-[#f5277f] hover:text-[#f5277f] bg-transparent",
    ghost: "bg-transparent hover:bg-[#222230]"
  };

  const playingClass = isPlaying ? "animate-playing ring-2 ring-[#f5277f]/30" : "";

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${playingClass} ${className}`}
      style={variant === 'outline' ? { borderColor: '#2a2a3a', color: '#8a8a9a' } : variant === 'ghost' ? { color: '#8a8a9a' } : undefined}
      disabled={isLoading || isPlaying || disabled}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading...</span>
        </>
      ) : isPlaying ? (
        <>
          <span className="flex gap-1 items-center">
            <span className="w-1 h-3 bg-current animate-pulse"></span>
            <span className="w-1 h-4 bg-current animate-pulse delay-75"></span>
            <span className="w-1 h-2 bg-current animate-pulse delay-150"></span>
          </span>
          <span>Playing...</span>
        </>
      ) : children}
    </button>
  );
};
