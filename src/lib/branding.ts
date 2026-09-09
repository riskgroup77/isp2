/** Dastur brend nomlari — barcha UI va eksport fayllarida shu konstantalar ishlatiladi */

export const APP_NAME =
  'Donozologik Monitoring va Kasbiy Riskni Prognozlash Milliy Portali';

/** Asosiy brend (to'liq nom, lotin) */
export const APP_BRAND = APP_NAME;

/** To'liq nom — o'zbek kirill */
export const APP_NAME_CYRL =
  'Донозологик мониторинг ва касбий рискни прогнозлаш миллий портали';

/** Chop etish / kartochka sarlavhasi */
export const APP_CARD_TITLE = `${APP_NAME} — kartasi`;

export const APP_CARD_TITLE_CYRL = `${APP_NAME_CYRL} — картаси`;

/** Domen (texnik — o'zgarmagan) */
export const APP_DOMAIN = 'energohealth-predict.uz';

/** Login va sarlavhalarda qisqa izoh */
export const APP_TAGLINE =
  'Donozologik monitoring, kasbiy risk prognozi va milliy axborot xizmatlari portali';

export const APP_TAGLINE_CYRL =
  'Донозологик мониторинг, касбий риск прогнози ва миллий ахборот хизматлари портали';

export const APP_DISCLAIMER =
  "Mazkur milliy portal donozologik monitoring va kasbiy riskni baholash, prognozlash hamda profilaktik ma'lumot berish uchun mo'ljallangan axborot tizimidir. U klinika emas va yakuniy tibbiy tashxis o'rnini bosa olmaydi.";

export const APP_DISCLAIMER_CYRL =
  'Мазкур миллий портал донозологик мониторинг ва касбий рискни баҳолаш, прогнозлаш ҳамда профилактик маълумот бериш учун мўлжалланган ахборот тизимидир. У клиника емас ва якуний тиббий ташхис ўрнини боса олмайди.';

export const APP_FOOTER_COPY = `${APP_NAME}.`;

export const APP_FOOTER_COPY_CYRL = `${APP_NAME_CYRL}.`;

/** So'rovnoma sarlavhasi */
export const SURVEY_TITLE = `Xodimlar uchun so'rovnoma — ${APP_NAME}`;

export const SURVEY_TITLE_CYRL = `Ходимлар учун сўровнома — ${APP_NAME_CYRL}`;

/** Excel / PDF fayl nomlari prefiksi */
export const APP_EXPORT_PREFIX = 'DMKRMP';

/** Lotin yoki kirill matnni tanlash */
export function pickBrandText(
  language: 'lotin' | 'kirill',
  lotin: string,
  cyrl: string
): string {
  return language === 'kirill' ? cyrl : lotin;
}
