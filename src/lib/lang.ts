/**
 * Uzbek Latin to Cyrillic and Cyrillic to Latin Transliterator
 */

const LATIN_TO_CYRILLIC_DIRECT_MAP: Record<string, string> = {
  "Shifokor": "Шифокор",
  "shifokor": "шифокор",
  "Bemor": "Бемор",
  "bemor": "бемор",
  "Admin": "Админ",
  "admin": "админ",
  "Chiqish": "Чиқиш",
  "chiqish": "чиқиш",
  "Kirish": "Кириш",
  "kirish": "кириш",
  "Tasdiqlash": "Тасдиқлаш",
  "tasdiqlash": "тасдиқлаш",
  "Sana": "Сана",
  "sana": "сана",
  "Vaqt": "Вақт",
  "vaqt": "вақт",
  "Yosh": "Ёш",
  "yosh": "ёш",
  "Jinsi": "Жинси",
  "jinsi": "жинси",
  "Bo'yi": "Бўйи",
  "bo'yi": "бўйи",
  "Vazni": "Вазни",
  "vazni": "вазни",
  "Puls": "Пульс",
  "puls": "пульс",
  "Erkak": "Эркак",
  "erkak": "эркак",
  "Ayol": "Аёл",
  "ayol": "аёл",
  "Ha": "Ҳа",
  "ha": "ҳа",
  "Yo'q": "Йўқ",
  "yo'q": "йўқ",
  "yoq": "йўқ",
  "Yoq": "Йўқ",
};

/**
 * Transliterates Uzbek Latin to Uzbek Cyrillic.
 * Designed dynamically to handle full sentences and paragraphs beautifully.
 */
export function latinToCyrillic(text: string): string {
  if (!text) return text;
  
  // First check if there is a direct match in our manually curated dictionary
  if (LATIN_TO_CYRILLIC_DIRECT_MAP[text]) {
    return LATIN_TO_CYRILLIC_DIRECT_MAP[text];
  }

  let result = text;

  // Multi-character sequences (Capital and lowercase combinations)
  const sequences: [RegExp, string][] = [
    // Double vowels and dipthongs / special combinations
    [/\b[Yy]e/g, "е"], // ye at word boundary -> е (capitalized in word loop)
    [/\bYE/g, "Е"],
    [/\bYe/g, "Е"],
    
    [/[Yy]o['’`‘]/g, "ё"], // yo' -> ё inside/starts (standardized)
    [/[Yy]o['’`‘]q/g, "йўқ"], // yo'q -> йўқ
    [/[Yy]o['’`‘]l/g, "йўл"], // yo'l -> йўл
    [/[Yy]o['’`‘]n/g, "йўн"],

    // Sh, Ch
    [/sh/g, "ш"], [/Sh/g, "Ш"], [/SH/g, "Ш"],
    [/ch/g, "ч"], [/Ch/g, "Ч"], [/CH/g, "Ч"],
    
    // Ya, Yu, Yo
    [/ya/g, "я"], [/Ya/g, "Я"], [/YA/g, "Я"],
    [/yu/g, "ю"], [/Yu/g, "Ю"], [/YU/g, "Ю"],
    [/yo/g, "ё"], [/Yo/g, "Ё"], [/YO/g, "Ё"],

    // O', G'
    [/o['’`‘]/g, "ў"], [/O['’`‘]/g, "Ў"],
    [/g['’`‘]/g, "ғ"], [/G['’`‘]/g, "Ғ"],

    // E at word start vs inside (e starting word is э, e inside word is е/э)
    [/\b[Ee]['’`‘]t/g, "эт"], // e'tibor -> эътибор
    [/\b[Ee]['’`‘]/g, "эъ"], // e'lon -> эълон
    [/\b[Ee]/g, "э"], [/\b[Ee]/g, "э"], [/\bE/g, "Э"],
    
    // Remaining consonants and vowels
    [/a/g, "а"], [/A/g, "А"],
    [/b/g, "б"], [/B/g, "Б"],
    [/d/g, "д"], [/D/g, "Д"],
    [/e/g, "е"], [/E/g, "Е"], // Inside words e is е
    [/f/g, "ф"], [/F/g, "Ф"],
    [/g/g, "г"], [/G/g, "Г"],
    [/h/g, "ҳ"], [/H/g, "Ҳ"],
    [/i/g, "и"], [/I/g, "И"],
    [/j/g, "ж"], [/J/g, "Ж"],
    [/k/g, "к"], [/K/g, "К"],
    [/l/g, "л"], [/L/g, "Л"],
    [/m/g, "м"], [/M/g, "М"],
    [/n/g, "н"], [/N/g, "Н"],
    [/o/g, "о"], [/O/g, "О"],
    [/p/g, "п"], [/P/g, "П"],
    [/q/g, "қ"], [/Q/g, "Қ"],
    [/r/g, "р"], [/R/g, "Р"],
    [/s/g, "с"], [/S/g, "С"],
    [/t/g, "т"], [/T/g, "Т"],
    [/u/g, "у"], [/U/g, "У"],
    [/v/g, "в"], [/V/g, "В"],
    [/x/g, "х"], [/X/g, "Х"],
    [/y/g, "й"], [/Y/g, "Й"],
    [/z/g, "з"], [/Z/g, "З"],
    [/['’`‘]/g, "ъ"]
  ];

  for (const [pattern, replacement] of sequences) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * Clean helper function to translate string under current language
 */
export function t(text: string | null | undefined, currentLang: 'lotin' | 'kirill'): string {
  if (!text) return "";
  if (currentLang === 'lotin') return text;
  return latinToCyrillic(text);
}
