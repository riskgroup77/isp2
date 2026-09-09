import { useEffect } from 'react';
import { APP_BRAND } from './branding';
import { t } from './lang';

export function usePageTitle(language: 'lotin' | 'kirill', suffix?: string) {
  useEffect(() => {
    const brand = t(APP_BRAND, language);
    document.title = suffix ? `${suffix} — ${brand}` : brand;
  }, [language, suffix]);
}
