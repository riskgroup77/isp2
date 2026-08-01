import { useCallback, useEffect, useState } from 'react';
import { checkApiHealth } from './api';
import { formatApiError } from './surveyUtils';

export type ApiHealthStatus = 'checking' | 'online' | 'offline';

export function useApiHealth() {
  const [status, setStatus] = useState<ApiHealthStatus>('checking');
  const [message, setMessage] = useState<string | null>(null);

  const retry = useCallback(async () => {
    setStatus('checking');
    setMessage(null);
    try {
      const ok = await checkApiHealth();
      if (ok) {
        setStatus('online');
        setMessage(null);
      } else {
        setStatus('offline');
        setMessage('Backend javob bermayapti (502 yoki tarmoq xatosi).');
      }
    } catch (err) {
      setStatus('offline');
      setMessage(formatApiError(err));
    }
  }, []);

  useEffect(() => {
    retry();
  }, [retry]);

  return { status, message, retry };
}
