import React from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { API_BASE_URL } from '../lib/api';

interface ApiStatusBannerProps {
  status: 'checking' | 'online' | 'offline';
  message?: string | null;
  onRetry?: () => void;
}

export default function ApiStatusBanner({ status, message, onRetry }: ApiStatusBannerProps) {
  if (status === 'online') return null;

  const isChecking = status === 'checking';

  return (
    <div
      className={`px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3 border-b ${
        isChecking
          ? 'bg-slate-100 border-slate-200 text-slate-700'
          : 'bg-red-50 border-red-200 text-red-800'
      }`}
    >
      <div className="flex items-center gap-2">
        {isChecking ? (
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          <WifiOff className="w-4 h-4 shrink-0" />
        )}
        <div>
          <p className="font-bold">
            {isChecking
              ? 'API holati tekshirilmoqda...'
              : 'Backend API vaqtincha ishlamayapti'}
          </p>
          <p className="text-xs opacity-90 mt-0.5">
            {message ||
              (isChecking
                ? API_BASE_URL
                : 'Login, so\'rovnoma va AI funksiyalari ishlamaydi. Kundalik ma\'lumotlar brauzerda saqlanadi.')}
          </p>
        </div>
      </div>
      {onRetry && !isChecking && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-300 text-xs font-bold hover:bg-red-100"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Qayta tekshirish
        </button>
      )}
      {!isChecking && (
        <span className="text-[10px] font-mono opacity-70 flex items-center gap-1">
          <Wifi className="w-3 h-3" />
          {API_BASE_URL}
        </span>
      )}
    </div>
  );
}
