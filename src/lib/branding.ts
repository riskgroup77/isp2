/** Dastur brend nomlari — barcha UI va eksport fayllarida shu konstantalar ishlatiladi */

export const APP_NAME =
  "Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali";

/** Asosiy brend (to'liq nom, lotin) */
export const APP_BRAND = APP_NAME;

/** To'liq nom — o'zbek kirill */
export const APP_NAME_CYRL =
  'Ноинфексион кардиологик хавфларни прогнозлаш ва мониторинг қилиш миллий-илмий кўп ролли портали';

/** Chop etish / kartochka sarlavhasi */
export const APP_CARD_TITLE = `Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali — kartasi`;

export const APP_CARD_TITLE_CYRL = `Ноинфексион кардиологик хавфларни прогнозлаш ва мониторинг қилиш миллий-илмий кўп ролли портали — картаси`;

/** Domen (texnik — o'zgarmagan) */
export const APP_DOMAIN = 'energohealth-predict.uz';

/** Login va sarlavhalarda qisqa izoh */
export const APP_TAGLINE =
  "Noinfeksion kardiologik xavflarni prognozlash, monitoring va ko'p rolli tibbiy xizmatlar uchun milliy-ilmiy axborot portali";

export const APP_TAGLINE_CYRL =
  'Ноинфексион кардиологик хавфларни прогнозлаш, мониторинг ва кўп ролли тиббий хизматлар учун миллий-илмий ахборот портали';

export const APP_DISCLAIMER =
  "Mazkur milliy-ilmiy ko'p rolli portal noinfeksion kardiologik xavflarni baholash, prognozlash va monitoring qilish hamda profilaktik ma'lumot berish uchun mo'ljallangan axborot tizimidir. U klinika emas va yakuniy tibbiy tashxis o'rnini bosa olmaydi.";

export const APP_DISCLAIMER_CYRL =
  'Мазкур миллий-илмий кўп ролли портал ноинфексион кардиологик хавфларни баҳолаш, прогнозлаш ва мониторинг қилиш ҳамда профилактик маълумот бериш учун мўлжалланган ахборот тизимидир. У клиника емас ва якуний тиббий ташхис ўрнини боса олмайди.';

export const APP_FOOTER_COPY =
  "Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali.";

export const APP_FOOTER_COPY_CYRL =
  'Ноинфексион кардиологик хавфларни прогнозлаш ва мониторинг қилиш миллий-илмий кўп ролли портали.';

/** So'rovnoma sarlavhasi */
export const SURVEY_TITLE = `Xodimlar uchun so'rovnoma — ${APP_NAME}`;

export const SURVEY_TITLE_CYRL = `Ходимлар учун сўровнома — Ноинфексион кардиологик хавфларни прогнозлаш ва мониторинг қилиш миллий-илмий кўп ролли портали`;

/** Excel / PDF fayl nomlari prefiksi */
export const APP_EXPORT_PREFIX = 'NKXMP';

/** Lotin yoki kirill matnni tanlash */
export function pickBrandText(
  language: 'lotin' | 'kirill',
  lotin: string,
  cyrl: string
): string {
  return language === 'kirill' ? cyrl : lotin;
}
