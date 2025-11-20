import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  isLoading, 
  variant = 'primary', 
  size = 'md',
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "border-transparent text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 focus:ring-indigo-500 shadow-indigo-500/30 hover:shadow-indigo-500/50",
    secondary: "border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:ring-slate-500",
    danger: "border-transparent text-white bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 focus:ring-red-500 shadow-red-500/30",
    ghost: "shadow-none text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
};

export default Button;