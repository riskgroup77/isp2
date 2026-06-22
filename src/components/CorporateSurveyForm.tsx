import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { 
  Building2, 
  User, 
  Flame, 
  Volume2, 
  ShieldCheck, 
  AlertTriangle, 
  HelpCircle, 
  Dribbble, 
  Heart, 
  Coffee, 
  FileSignature, 
  Check, 
  AlertCircle,
  Printer,
  Clock,
  ArrowLeft,
  Activity,
  CheckCircle,
  TrendingDown,
  RefreshCw,
  FileText,
  FileDown
} from 'lucide-react';
import { CorporateSurvey, UserProfile, QuestionnaireData } from '../types';

interface CorporateSurveyFormProps {
  onSave: (survey: CorporateSurvey, questionnaireData?: QuestionnaireData, riskResult?: any) => void;
  language: 'lotin' | 'kirill';
  currentUser: UserProfile | null;
}

export default function CorporateSurveyForm({ onSave, language, currentUser }: CorporateSurveyFormProps) {
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isCalculatingRisk, setIsCalculatingRisk] = useState(false);
  const [corpRiskResult, setCorpRiskResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initial State for Corporate survey
  const [fields, setFields] = useState<Omit<CorporateSurvey, 'id' | 'sana'>>({
    tashkilotNomi: 'Respublika Energetika Tizimi',
    yoshi: '',
    vazni: '',
    jins: 'erkak',
    oilaviyHolat: 'turmush_qurgan',
    malumotDarajasi: 'kasb_hunar',
    kasbi: 'Texnik mutaxassis',
    kasbiBoshqa: '',
    sex: 'Turbinalar sexi',
    sexBoshqa: '',
    ishStaji: '2_to_4',
    ishTartibi: 'smenali',

    shovqinDarajasi: 'ortacha',
    yuqoriHarorat: 'yoq',
    himoyaVositalari: 'doim',
    tashvishlar: [] as string[],
    yangiOrganish: 'malum',
    ishMuhimligi: 'katta',
    ishdanQoniqish: 'qoniqardim',
    ishSalbiyEnergiya: 'ha_ozgina',
    jismoniyCharchoq: 'bazan',
    asabiylashish: 'bazan',
    tikOyoqdaSoat: '',
    uyquOzgarishlar: '',
    yurakUrishiBoshAylanish: '',
    stressXavotirQorgu: '',
    quruqYotalNafasQisishi: '',
    mushaklarOgriq: '',
    quloqShangillashKoziXiralashish: '',
    ishtahaBogliqlik: '',

    soglikBahosi: 'ortacha',
    tibbiyKorikMuntazam: 'ha',
    profilaktikKorikIkkiYil: 'ha',
    qonBosiminiBiladimi: 'ha',
    qonBosimiQiymati: '',
    grippEmlash: 'yoq',
    songgiOltiOyHolatlar: [] as string[],
    birYilKasalliklar: [] as string[],
    birYilKasalliklarBoshqa: '',
    surunkaliKasallik: 'yoq',
    surunkaliKasallikNomi: '',
    ishSalbiySoglik: 'qisman',
    sportZalFoydalanish: 'Yo\'q',
    vaucherBerilishi: 'yoq',
    vaucherMoliyalashtirish: '',
    jamoaviyShartnomaQoniqish: 'ha',

    tamakiFoydalanish: 'hech_qachon',
    sportShugullanish: 'yoq_lekin_xohlardi',
    sportShugullanmaslikSabablar: [] as string[],
    sportTurlari: [] as string[],
    sportTurlariBoshqa: '',
    mashqTezligi: '',

    tibbiyYordamYetarliligi: 'qisman',
    kasbgaBoglikKasallikAniqlanganmi: 'yoq',
    soglomTurmushImkoniyat: 'qisman',
    ishStresslimi: 'bazan',
    damOlishgaVaqt: 'ha',

    ishKuniOziqlanish: 'oshxona_kafe',
    oshxonagaTashrif: 'vaqti_vaqti',
    oshxonagaBormaslikSabablar: [] as string[],
    oshxonagaBormaslikSabablarBoshqa: '',
    kunlikOziqlanishSoni: '3',
    nonTuri: 'oq',
    tuzQoshish: 'tatib_korib_kam_bolsa',
    kunlikSuvMiqdori: 'yetarli',

    sogliqniSaqlashTakliflar: '',
    sharoitYaxshilashTakliflar: '',
    sexBoshligiImzo: ''
  });

  const t_label = (uzLotin: string, uzKirill: string) => {
    return language === 'lotin' ? uzLotin : uzKirill;
  };

  const handleCheckboxChange = (field: 'tashvishlar' | 'songgiOltiOyHolatlar' | 'birYilKasalliklar' | 'sportShugullanmaslikSabablar' | 'sportTurlari' | 'oshxonagaBormaslikSabablar', value: string) => {
    const arr = [...(fields[field] as string[])];
    const index = arr.indexOf(value);
    if (index === -1) {
      arr.push(value);
    } else {
      arr.splice(index, 1);
    }
    setFields(prev => ({ ...prev, [field]: arr }));
  };

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentAccepted) {
      alert(t_label(
        "Iltimos, so'rovnomada ishtirok etish uchun rozilik tasdig'ini belgilang!",
        "Илтимос, сўровномаda иштирок этиш учун розилик тасдиғини белгиланг!"
      ));
      return;
    }

    setIsCalculatingRisk(true);
    setErrorMsg(null);

    // Prepare complete item
    const finalSurvey: CorporateSurvey = {
      id: 'corp-' + Math.random().toString(36).substr(2, 9),
      sana: new Date().toLocaleDateString('uz-UZ'),
      ...fields
    };

    // Parse blood pressure
    let sistolik = 120;
    let diastolik = 80;
    if (fields.qonBosimiQiymati) {
      const parts = fields.qonBosimiQiymati.split('/');
      if (parts.length >= 1) {
        const s = parseInt(parts[0], 10);
        if (!isNaN(s) && s > 50 && s < 250) sistolik = s;
      }
      if (parts.length >= 2) {
        const d = parseInt(parts[1], 10);
        if (!isNaN(d) && d > 30 && d < 180) diastolik = d;
      }
    }

    // Build erkinShikoyat
    const complaints: string[] = [];
    if (fields.uyquOzgarishlar) complaints.push(`Uyqu muammosi: ${fields.uyquOzgarishlar}`);
    if (fields.yurakUrishiBoshAylanish) complaints.push(`Yurak o'ynashi/bosh aylanish: ${fields.yurakUrishiBoshAylanish}`);
    if (fields.stressXavotirQorgu) complaints.push(`Stress va xavotir: ${fields.stressXavotirQorgu}`);
    if (fields.quruqYotalNafasQisishi) complaints.push(`Yo'tal/nafas qisishi: ${fields.quruqYotalNafasQisishi}`);
    if (fields.mushaklarOgriq) complaints.push(`Mushak va bo'g'im og'rig'i: ${fields.mushaklarOgriq}`);
    if (fields.quloqShangillashKoziXiralashish) complaints.push(`Quloq shangillash/ko'z xiralashish: ${fields.quloqShangillashKoziXiralashish}`);
    if (fields.ishtahaBogliqlik) complaints.push(`Ishtaha o'zgarishi: ${fields.ishtahaBogliqlik}`);
    const combinedComplaints = complaints.join('. ');

    const parentDiseases: string[] = [];
    if (fields.birYilKasalliklar && Array.isArray(fields.birYilKasalliklar)) {
      if (fields.birYilKasalliklar.includes('gipertoniya')) parentDiseases.push('gipertoniya');
      if (fields.birYilKasalliklar.includes('saxarli_diabet')) parentDiseases.push('diabet');
      if (fields.birYilKasalliklar.includes('yurak_ishemik')) parentDiseases.push('yurak_xastaligi');
      if (fields.birYilKasalliklar.includes('insult')) parentDiseases.push('insult');
    }

    const dataToSubmit: QuestionnaireData = {
      yosh: Number(fields.yoshi) || 40,
      jins: fields.jins || 'erkak',
      boy: fields.jins === 'erkak' ? 173 : 162,
      vazn: Number(fields.vazni) || 75,
      sistolik,
      diastolik,
      glyukoza: '',
      xolesterin: '',
      tuzIstemi: fields.tuzQoshish === 'tatib_kormay_qoshadi' ? 'yuqori' : (fields.tuzQoshish === 'tatib_korib_kam_bolsa' ? 'ortacha' : 'past'),
      shakarVaXamir: fields.nonTuri === 'oq' ? 'kop' : 'ortacha',
      sabzavotMeva: 'har_kuni',
      jismoniyFaollik: fields.sportShugullanish === 'muntazam_yoki_vaqti_vaqti' ? 'yuqori' : (fields.sportShugullanish === 'yoq_lekin_xohlardi' ? 'ortacha' : 'kam'),
      chekish: fields.tamakiFoydalanish === 'hozir_chekadi' ? 'ha' : (fields.tamakiFoydalanish === 'ilgari_chekkan' ? 'chekar_edi' : 'yoq'),
      nosvoy: 'yoq',
      oiladaKasallik: parentDiseases,
      tibbiyotXodimi: fields.kasbi === 'tibbiyot',
      nazariyBilimDarajasi: 'yaxshi',
      realKomplayens: fields.tibbiyKorikMuntazam === 'ha' ? 'yaxshi' : (fields.tibbiyKorikMuntazam === 'yoq' ? 'past' : 'ortacha'),
      shaharTuman: fields.tashkilotNomi || "Farg'ona shahri",
      erkinShikoyat: combinedComplaints
    };

    fetch('/api/predict-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSubmit)
    })
      .then(res => {
        if (!res.ok) throw new Error("Scientific estimation failed");
        return res.json();
      })
      .then((data) => {
        setCorpRiskResult(data);
        onSave({ ...finalSurvey, sexBoshligiImzo: `Tizimli kashfiyot (Xavf darajasi: ${data.riskFoizi}%)` }, dataToSubmit, data);
        setFormSubmitted(true);
        setIsCalculatingRisk(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch((err) => {
        console.error(err);
        // Robust offline fallback math modeling
        const estimatedTmi = (Number(fields.vazni) || 75) / Math.pow((fields.jins === 'erkak' ? 1.73 : 1.62), 2);
        const estimatedRisk = Math.min(95, Math.max(10, Math.round((Number(fields.yoshi) || 40) * 0.8 + (estimatedTmi - 20) * 1.5 + (sistolik - 100) * 0.4)));
        const fallbackFallbackResult = {
          tmi: estimatedTmi,
          tmiKategoriya: estimatedTmi >= 30 ? "Semizlik (Yuqori xavf)" : (estimatedTmi >= 25 ? "Ortiqcha vazn" : "Me'yorda"),
          riskFoizi: estimatedRisk,
          zona: estimatedRisk >= 70 ? 'qizil' : (estimatedRisk >= 35 ? 'sariq' : 'yashil'),
          hududiyStatistika: {
            hududXavfi: 38,
            populyatsiyaEtalonBosim: "120/80 mmHg",
            tavsiyaEtilganSkriningKuni: "Muntazam ravishda juma kunlari"
          },
          faktorlar: [
            { nomi: "Arterial qon bosimi", tafsilot: `Sizda qon bosimi ko'rsatkichi ${sistolik}/${diastolik} mmHg ni tashkil qiladi.`, tasirKuchi: sistolik >= 140 ? 9 : 3, boshqariladimi: true },
            { nomi: "Tana massasi indeksi (TMI)", tafsilot: `TMI: ${estimatedTmi.toFixed(1)}. Ortiqcha vazn kardiologik xavflarni oshiradi.`, tasirKuchi: estimatedTmi >= 25 ? 6 : 1, boshqariladimi: true }
          ],
          shaxsiyTavsiyalar: {
            kritikOmillar: [sistolik >= 140 ? "Yuqori qon bosimi" : "Qon bosimi monitoringi", estimatedTmi >= 25 ? "Ortiqcha vazn" : "Sog'lom reja"],
            ovqatlanish: ["Tuz iste'molini kuniga 5 grammgacha cheklang", "Xamirli va uglevodli choy va ovqatlarni tejang", "Yashil bargli sabzavotlarni ko'proq iste'mol qiling"],
            jismoniyMashq: ["O'rta jadal yurish (kamida 30 daqiqa)", "Kuniga 8000 qadam piyoda yurish", "Faol hayot tarzini shakllantirish"],
            tibbiyReja: ["Kardiolog shifokor ko'rigidan o'ting", "Qon bosimingizni muntazam nazorat qilib boring", "Qondagi glyukoza va xolesterin miqdorini tahlil qildiring"],
            kutilayotganEffekt: [{ ozgarish: "Turmush tarzini to'g'irlash", kamayadiganXavf: Math.round(estimatedRisk * 0.2) }]
          },
          klinikXulosa: `Xodim salomatligini kashf qilish formulasiga ko'ra sizda umumiy kardiologik va metabolik risk darajasi ${estimatedRisk}% ni tashkil etadi.`
        };
        setCorpRiskResult(fallbackFallbackResult);
        onSave({ ...finalSurvey, sexBoshligiImzo: `Tahlil bajarildi (Taxminiy risk: ${estimatedRisk}%)` }, dataToSubmit, fallbackFallbackResult);
        setFormSubmitted(true);
        setIsCalculatingRisk(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
  };

  const stepsList = [
    { num: 1, label: t_label("Umumiy", "Умумий") },
    { num: 2, label: t_label("Sharoit", "Шароит") },
    { num: 3, label: t_label("Salomatlik", "Саломатлик") },
    { num: 4, label: t_label("Hayot Tarzi", "Ҳаёт Тарзи") },
    { num: 5, label: t_label("Profilaktika", "Профилактика") },
    { num: 6, label: t_label("Ovqatlanish", "Овқатланиш") },
    { num: 7, label: t_label("Taklif & Imzo", "Таклиф & Имзо") }
  ];

  if (formSubmitted && corpRiskResult) {
    // Determine color scheme based on zone
    const zoneColor = corpRiskResult.zona === 'yashil' 
      ? { text: 'text-emerald-700 bg-emerald-50 border-emerald-200', circle: '#10b981', name: t_label('Yashil Zona', 'Яшил Зона') }
      : corpRiskResult.zona === 'sariq'
        ? { text: 'text-amber-700 bg-amber-50 border-amber-200', circle: '#f59e0b', name: t_label('Sariq Zona', 'Сариқ Зона') }
        : { text: 'text-red-700 bg-red-50 border-red-200', circle: '#ef4444', name: t_label('Qizil Zona', 'Қизил Зона') };

    // Get potential health complications / problems (Qanday kasalliklar va muammolar kelib chiqadi)
    const complicationsList = [];
    const tmiVal = corpRiskResult.tmi;
    
    if (corpRiskResult.zona === 'qizil') {
      complicationsList.push({
        title: t_label("O'tkir Yurak-Tomir Asoratlari (Infarqt va Insult)", "Ўткир Юрак-Томир Асоратлари (Инфаркт ва Инсульт)"),
        desc: t_label("Qon bosimining nazoratsiz ko'tarilishi yoki davolanmaslik natijasida tomirlarning infarkt va insult kabi to'satdan yorilishi va tiqilib qolishi xavfi o'ta yuqori.", "Қон босимининг назоратсиз кўтарилиши ёки даволанмаслик натижасида томирларнинг инфаркт ва инсульт каби тўсатдан ёрилиши ва тиқилиб қолиши хавфи ўта юқори.")
      });
      complicationsList.push({
        title: t_label("Surunkali buyrak kasalligi va peshob patologiyasi", "Сурункали буйрак касаллиги ва пешоб патологияси"),
        desc: t_label("Yuqori bosim va moddalar almashinuvi sekinlashuvi natijasida jadal buyrak mikrosirkulyatsiyasi buziladi va nefroskleroz asorati rivojlanadi.", "Юқири босим ва моддалар алмашинуви секинлашуви натижасида жадал буйрак микроциркуляцияси бузилади ва нефросклероз асорати ривожланади.")
      });
      complicationsList.push({
        title: t_label("Gipoksik to'qima o'zgarishlari va yurak yetishmovchiligi", "Гипоксик тўқима ўзгаришлари ва юрак етишмовчилиги"),
        desc: t_label("Tomirlar elastikligining pasayishi tufayli chap qorincha gipertrofiyasi shakllanib, barcha organlarga qon yetkazib berish oqsaydi.", "Томирлар эластиклигининг пасайиши туфайли чап қоринча гипертрофияси шаклланиб, барча органларга қон етказиб бериш оқсайди.")
      });
    } else if (corpRiskResult.zona === 'sariq') {
      complicationsList.push({
        title: t_label("Doimiy gipertoniya kasalligi", "Доимий гипертония касаллиги"),
        desc: t_label("Hozirgi vaqti-vaqti bilan bosim oshishlari tez orada doimiy xarakterga aylanib, yurak tomir tizimini kundan kunga charchatadi.", "Ҳозирги вақти-вақти билан босим ошишлари тез орада доимий характерга айланиб, юрак томир тизимини кундан кунга чарчатади.")
      });
      complicationsList.push({
        title: t_label("2-toifa qandli diabet va pre-diabet", "2-тоифа қандли диабет ва пре-диабет"),
        desc: t_label("Milliy xamirli va shirin taomlar hamda harakatsizlik sababli insulin sezuvchanligi pasayib, pre-diabet holati diabetga aylanadi.", "Миллий хамирли ва ширин таомлар ҳамда ҳаракатсизлик сабабли инсулин сезувчанлиги пасайиб, пре-диабет ҳолати диабетга айланади.")
      });
      if (tmiVal >= 25) {
        complicationsList.push({
          title: t_label("Jigar steatozi va lipid almashinuvi buzilishi", "Жигар стеатози ва липид алмашинуви бузилиши"),
          desc: t_label("Ortiqcha vazn hisobiga jigarda yog' to'planishi, xolesterin miqdori oshishi va qon quyuqlashishi ehtimoli mavjud.", "Ортиқча вазн ҳисобига жигарда ёғ тўпланиши, холестерин миқдори ошиши ва қон қуюқлашиши эҳтимоли мавжуд.")
        });
      }
    } else {
      complicationsList.push({
        title: t_label("Yosh o'tishi bilan bog'liq kardiomonitoring buzilishlari", "Ёш ўтиши билан боғлиқ кардиомониторинг бузилишлари"),
        desc: t_label("Hozir salomatlik xavfi me'yorda bo'lgani bilan, kelajakda nosg'lom turmush tarzi yoki stress ta'sirida engil gipertoniya kelib chiqishi mumkin.", "Ҳозир саломатлик хавфи меъёрда бўлгани билан, келажакда носғлом турмуш тарзи ёки стресс таъсирида енгил гйпертония келиб чиқиши мумкин.")
      });
    }

    const handleDownloadPDF = () => {
      // Create PDF
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Transliterant mapping helper for default Helvetica font
      const cleanStr = (txt: string) => {
        if (!txt) return '';
        const mapping: { [key: string]: string } = {
          'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'J', 'З': 'Z', 'И': 'I',
          'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T',
          'У': 'U', 'Ф': 'F', 'Х': 'X', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E',
          'Ю': 'Yu', 'Я': 'Ya', 'Ў': "O'", 'Қ': 'Q', 'Ҳ': 'H', 'Ғ': "G'",
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z', 'и': 'i',
          'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
          'у': 'u', 'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e',
          'ю': 'yu', 'я': 'ya', 'ў': "o'", 'қ': 'q', 'ҳ': 'h', 'ғ': "g'"
        };
        return txt.split('').map(char => mapping[char] !== undefined ? mapping[char] : char).join('');
      };

      let yPos = 15;

      // Header Bar
      doc.setFillColor(26, 54, 93);
      doc.rect(10, yPos, 190, 10, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text("SOG'LIQNI SAQLASH VA PROFILAKTIKA TIZIMI - ENERGOHEALTH-PREDICT", 14, yPos + 6.5);
      
      yPos += 18;

      // Main title 
      doc.setFontSize(14);
      doc.setTextColor(26, 54, 93);
      doc.text("XODIM SALOMATLIGI VA KARDIOLOGIK RISK HISOBOTI", 10, yPos);
      yPos += 7;

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.text("Xodimlar uchun so'rovnoma natijalari va aniqlangan salomatlik muammolari", 10, yPos);
      
      // Stamp SANA
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(13, 148, 136);
      doc.text(`Sana: ${new Date().toLocaleDateString('uz-UZ')}`, 160, yPos);

      yPos += 5;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(10, yPos, 200, yPos);
      yPos += 8;

      // Card for Employee info
      doc.setFillColor(248, 250, 252);
      doc.rect(10, yPos, 190, 36, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(10, yPos, 190, 36, 'S');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(26, 54, 93);
      doc.text("XODIM VA TASHKILOT DIAGNOSTIKASI", 14, yPos + 6);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(`Tashkilot nomi: ${cleanStr(fields.tashkilotNomi || '')}`, 14, yPos + 13);
      doc.text(`Sex / Bo'lim: ${cleanStr(fields.sex || 'Asosiy bo\'lim')}`, 14, yPos + 19);
      doc.text(`Ish / Kasbi: ${cleanStr(fields.kasbi || '')}`, 14, yPos + 25);
      doc.text(`Yoshi / Jinsi: ${fields.yoshi || '40'} yosh / ${fields.jins === 'erkak' ? 'Erkak' : 'Ayol'}`, 14, yPos + 31);

      doc.text(`Arterial bosim: ${fields.qonBosimiQiymati || '120/80'} mmHg`, 110, yPos + 13);
      doc.text(`Vazni: ${fields.vazni || '75'} kg`, 110, yPos + 19);
      doc.text(`Tana massasi indeksi: ${corpRiskResult.tmi.toFixed(1)} kg/m2`, 110, yPos + 25);
      doc.text(`TMI Kategoriyasi: ${cleanStr(corpRiskResult.tmiKategoriya)}`, 110, yPos + 31);

      yPos += 44;

      // Clinical decision and Risk gauge card
      doc.setFillColor(254, 242, 242);
      doc.rect(10, yPos, 190, 30, 'F');
      doc.setDrawColor(254, 202, 202);
      doc.rect(10, yPos, 190, 30, 'S');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(153, 27, 27);
      doc.text(`Kardiologik risk darajasi: ${corpRiskResult.riskFoizi}% (ZONA: ${cleanStr(zoneColor.name).toUpperCase()})`, 14, yPos + 7);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      
      const splitKlinik = doc.splitTextToSize(`Klinik xulosa: ${cleanStr(corpRiskResult.klinikXulosa)}`, 182);
      doc.text(splitKlinik, 14, yPos + 13);

      yPos += 37;

      // SECTION 3: IDENTIFIED HEALTH PROBLEMS
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(26, 54, 93);
      doc.text("ANIQLANGAN SALOMATLIK MUAMMOLARI VA ASORATLAR", 10, yPos);
      yPos += 6;

      if (complicationsList && complicationsList.length > 0) {
        complicationsList.forEach((comp) => {
          if (yPos > 265) {
            doc.addPage();
            yPos = 15;
          }
          doc.setFillColor(255, 251, 235); // warm gold
          doc.rect(10, yPos, 190, 15, 'F');
          doc.setDrawColor(253, 230, 138);
          doc.rect(10, yPos, 190, 15, 'S');

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(180, 83, 9); // amber 800
          doc.text(`[MUAMMO] ${cleanStr(comp.title)}`, 14, yPos + 5.5);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(64, 64, 64);
          const splitDesc = doc.splitTextToSize(cleanStr(comp.desc), 182);
          doc.text(splitDesc, 14, yPos + 10.5);
          yPos += 18;
        });
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("Skrining tahlili bo'yicha mutaxassis asoratlari aniqlanmadi.", 14, yPos + 4);
        yPos += 10;
      }

      yPos += 4;

      // Page Break for recommendations to make it beautifully presented
      doc.addPage();
      yPos = 15;

      // Header on Page 2
      doc.setFillColor(26, 54, 93);
      doc.rect(10, yPos, 190, 8, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text("SHAXSIY PROFILAKTIKA VA KORPORATIV TIBBIY DIAGNOSTIKA REJASI", 14, yPos + 5.5);
      yPos += 15;

      // SECTION 4: RISK FACTORS IN DETAIL
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(26, 54, 93);
      doc.text("PRIMARY RISK FACTORS & COEFFS (KARDIOLOGIK FAKTORLAR)", 10, yPos);
      yPos += 6;

      doc.setFontSize(8);
      corpRiskResult.faktorlar.forEach((factor: any, idx: number) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(`${idx + 1}. ${cleanStr(factor.nomi)} (Ta'sir kuchi: ${factor.tasirKuchi} ball)`, 12, yPos + 4);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const splitTafsilot = doc.splitTextToSize(cleanStr(factor.tafsilot), 180);
        doc.text(splitTafsilot, 14, yPos + 9);
        yPos += 15;
      });

      yPos += 5;

      // SECTION 5: PERSONAL RECOMMENDATIONS
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(26, 54, 93);
      doc.text("SHAXSIY SALOMATLIK REJALARI", 10, yPos);
      yPos += 6;

      // Oziqlanish (Diet Plan)
      doc.setFontSize(9);
      doc.setTextColor(180, 83, 9); // amber
      doc.text("A) Sog'lom ovqatlanish munosabati:", 12, yPos);
      yPos += 5.5;

      doc.setFontSize(8);
      doc.setTextColor(64, 64, 64);
      corpRiskResult.shaxsiyTavsiyalar.ovqatlanish.forEach((item: string) => {
        doc.text(`- ${cleanStr(item)}`, 16, yPos);
        yPos += 4.5;
      });

      yPos += 4;

      // Jismoniy
      doc.setFontSize(9);
      doc.setTextColor(21, 128, 61); // green
      doc.text("B) Jismoniy faollik koeffitsientini oshirish rejasi:", 12, yPos);
      yPos += 5.5;

      doc.setFontSize(8);
      doc.setTextColor(64, 64, 64);
      corpRiskResult.shaxsiyTavsiyalar.jismoniyMashq.forEach((item: string) => {
        doc.text(`- ${cleanStr(item)}`, 16, yPos);
        yPos += 4.5;
      });

      yPos += 4;

      // Profilaktika
      doc.setFontSize(9);
      doc.setTextColor(29, 78, 216); // blue
      doc.text("C) Tibbiy profilaktik-dori va kardiologik nazorat rejasi:", 12, yPos);
      yPos += 5.5;

      doc.setFontSize(8);
      doc.setTextColor(64, 64, 64);
      corpRiskResult.shaxsiyTavsiyalar.tibbiyReja.forEach((item: string) => {
        doc.text(`- ${cleanStr(item)}`, 16, yPos);
        yPos += 4.5;
      });

      yPos += 8;

      // Footer signature decoration
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(10, yPos, 200, yPos);
      yPos += 6;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Ushbu hisobot raqamli ravishda EnergoHealth-Predict kashfiyot formulasi asosida imzolangan.", 10, yPos);
      doc.text("ID: ERP-VERIFIED", 160, yPos);

      doc.save(`Xodim_Salomatlik_Hisoboti_${fields.yoshi || '40'}_yosh_${cleanStr(fields.tashkilotNomi || '')}.pdf`);
    };

    return (
      <div className="space-y-8 animate-fade-in print:p-0">
        
        {/* HEADER CONTROLS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm md:text-base">{t_label("Xodim Salomatlik Risk Hisoboti", "Ходим Саломатлик Риск Ҳисоботи")}</h4>
              <p className="text-slate-400 font-bold text-[10px] tracking-wide">EnergoHealth-Predict • {new Date().toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={() => window.print()}
              className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow"
            >
              <Printer className="w-4 h-4" />
              <span>{t_label("Chop etish / PDF yuklash", "Чоп этиш / PDF юклаш")}</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow"
            >
              <FileDown className="w-4 h-4" />
              <span>{t_label("Hisobotni Yuklash", "Ҳисоботни Юклаш")}</span>
            </button>
            <button
              onClick={() => {
                setFormSubmitted(false);
                setConsentAccepted(false);
                setCorpRiskResult(null);
                setActiveStep(1);
              }}
              className="flex-1 sm:flex-initial px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
            >
              {t_label("Qaytish / Yangi so'rovnoma", "Қайтиш / Янги сўровнома")}
            </button>
          </div>
        </div>

        {/* PRINTABLE AREA */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden print:border-none print:shadow-none text-left">
          
          {/* Cover Header for print */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white px-8 py-10 text-left relative overflow-hidden">
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
              <Heart className="w-80 h-80 stroke-[4]" />
            </div>
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-widest leading-none">
                  Xodim Tahlili • #{Math.floor(Number(fields.vazni || 70) * 1234)}
                </span>
                <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">{t_label("Ilmiy Dissertatsiya Donozologiya Skaneri", "Илмий Диссертация Донозология Сканери")}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
                {t_label("Xodim Salomatligi va Kardiologik Risk Tahlili", "Ходим Саломатлиги ва Кардиологик Риск Таҳлили")}
              </h2>
              <p className="text-xs text-indigo-200 opacity-90 max-w-2xl font-medium leading-relaxed">
                {t_label(
                  "Ushbu tahliliy hisobot Farg'ona vodiysi aholisi populyatsiyasi uchun ishlab chiqilgan maxsus tibbiy donozologik modellar hamda xodim profilaktika normalari asosida generatsiya etilgan shaxsiy salomatlik hujjati hisoblanadi.",
                  "Ушбу таҳлилий ҳисобот Фарғона водийси аҳолиси популяцияси учун ишлаб чиқилган махсус тиббий донозологик моделлар ҳамда ходим профилактика нормалари асосида генерация этилган шахсий саломатлик ҳужжати ҳисобланади."
                )}
              </p>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            
            {/* PERSONAL METADATA SECTION */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left">
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t_label("Tashkilot nomi", "Ташкилот номи")}</span>
                <span className="text-xs font-black text-slate-800 leading-normal">{fields.tashkilotNomi}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t_label("Sex / Bo'lim", "Цех / Бўлим")}</span>
                <span className="text-xs font-black text-slate-800 leading-normal">{fields.sex || 'Asosiy bo\'lim'}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t_label("Lavozimi / Kasbi", "Лавозими / Касби")}</span>
                <span className="text-xs font-black text-slate-800 leading-normal">{fields.kasbi}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t_label("Tekshirilgan sana", "Текширилган сана")}</span>
                <span className="text-xs font-black text-slate-800 leading-normal">{new Date().toLocaleDateString('uz-UZ')}</span>
              </div>
              
              <div className="border-t pt-2.5 mt-2.5 col-span-2 md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-slate-200">
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t_label("Yoshi / Jinsi", "Ёши / Жинси")}</span>
                  <span className="text-xs font-black text-slate-800 leading-normal">{fields.yoshi || '40'} yosh / {fields.jins === 'erkak' ? t_label('Erkak', 'Эркак') : t_label('Ayol', 'Аёл')}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t_label("Tana massasi indeksi (TMI)", "Tана massaси индекси (ТМИ)")}</span>
                  <span className="text-xs font-black text-slate-800 leading-normal">{corpRiskResult.tmi.toFixed(1)} kg/m² ({corpRiskResult.tmiKategoriya})</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t_label("Arterial qon bosimi", "Артериал қон босими")}</span>
                  <span className="text-xs font-black text-slate-800 leading-normal">{fields.qonBosimiQiymati || '120/80'} mmHg</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t_label("Tahlil turi", "Таҳлил тури")}</span>
                  <span className="text-xs font-black text-indigo-700 leading-none bg-indigo-50 px-2 py-0.5 rounded inline-block border border-indigo-200 mt-1">{t_label("Korporativ tibbiy reja", "Корпоратив тиббий режа")}</span>
                </div>
              </div>
            </div>

            {/* MAIN CHART AND DETAILS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left">
              
              {/* Left Column: Semicircle Gauge */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t_label("Kardiologik risk darajasi", "Кардиологик риск даражаси")}</span>
                
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="65"
                      stroke="#f1f5f9"
                      strokeWidth="14"
                      fill="transparent"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="65"
                      stroke={zoneColor.circle}
                      strokeWidth="14"
                      fill="transparent"
                      strokeDasharray={408}
                      strokeDashoffset={408 - (408 * corpRiskResult.riskFoizi) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-4xl font-black tracking-tight text-slate-900">{corpRiskResult.riskFoizi}%</span>
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider mt-0.5">{t_label("Yillik xavf", "Йиллик хавф")}</span>
                  </div>
                </div>

                <div className={`px-4 py-1.5 rounded-full text-xs font-extrabold border shadow-sm ${zoneColor.text}`}>
                  {zoneColor.name}
                </div>

                <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed tracking-wider">
                  {t_label("Farg'ona populatsiya indeksi etaloniga munosabati", "Фарғона популяция индекси эталонига муносабати")}
                </p>
              </div>

              {/* Right Column: Clinical conclusion (Klinik Xulosa) */}
              <div className="lg:col-span-8 space-y-5">
                <div className="bg-indigo-50/20 rounded-2xl border border-indigo-100 p-6">
                  <div className="flex items-center gap-2 border-b border-indigo-100/60 pb-3 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                    <h3 className="font-extrabold text-xs uppercase tracking-widest text-indigo-950">
                      {t_label("Shifokor va AI Tahlil Xulosasi", "Шифокор ва АИ Таҳлил Хулосаси")}
                    </h3>
                  </div>
                  <p className="text-slate-700 text-sm font-medium leading-relaxed italic">
                    "{corpRiskResult.klinikXulosa}"
                  </p>
                </div>

                {/* DYNAMIC COMPLICATIONS PANEL (Core User Requirement!) */}
                <div className="bg-rose-50/25 border border-rose-100 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-rose-500 w-5 h-5 shrink-0" />
                    <h3 className="font-extrabold text-sm text-rose-950 uppercase tracking-widest">
                      {t_label("Sog'ligingizda kelib chiqadigan ehtimoliy muammolar (Asoratlar)", "Соғлиғингизда келиб чиқадиган эҳтимолий муаммолар (Асоратлар)")}
                    </h3>
                  </div>
                  <p className="text-xs text-rose-800 font-bold uppercase tracking-wider leading-none">
                    {t_label("Profilaktik choralarsiz va parhezsiz yaqin kelajakda rivojlanuvchi patologiyalar:", "Профилактик чораларсиз ва парҳезсиз яқин келажакда ривожланувчи патологиялар:")}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {complicationsList.map((comp, idx) => (
                      <div key={idx} className="bg-white rounded-xl p-4 border border-rose-100 shadow-sm space-y-1 text-left">
                        <span className="text-xs font-black text-rose-800 flex items-center gap-1.5 leading-tight">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                          {comp.title}
                        </span>
                        <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                          {comp.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* THIRD BLOCK: CRITICAL RISK FACTORS / TABULAR ANALYSIS */}
            <div className="space-y-4 text-left">
              <h3 className="font-extrabold text-xs uppercase tracking-widest text-slate-500">
                {t_label("Birlamchi kardiologik xavfli faktorlar tahlili", "Бирламчи кардиологик хавфли факторлар таҳлили")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {corpRiskResult.faktorlar.map((factor: any, index: number) => (
                  <div key={index} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 flex flex-col justify-between shadow-sm">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-black text-slate-800 leading-tight">{factor.nomi}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-black shrink-0 ${
                          factor.tasirKuchi >= 7 
                            ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {factor.tasirKuchi.toFixed(1)} ball
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-semibold mt-1 leading-normal">{factor.tafsilot}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-200 mt-2 flex justify-between items-center text-[9px] font-bold">
                      <span className="text-slate-400 font-bold uppercase">{t_label("Boshqarish:", "Бошқариш:")}</span>
                      <span className={factor.boshqariladimi ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200' : 'text-slate-500 bg-slate-100 px-2 py-0.5 rounded'}>
                        {factor.boshqariladimi ? t_label('Boshqarib bo\'ladi', 'Бошқариб бўлади') : t_label('Nasliy moyillik', 'Наслий мойиллик')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FOURTH BLOCK: EXPERT ADVICES (NUTRITIONAL, PHYSICAL AND CLINICAL PLANS) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left border-t border-slate-200 pt-6">
              
              {/* Oziqlanish (Diet Plan) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-indigo-950 font-black text-xs uppercase tracking-widest pb-1.5 border-b border-indigo-100">
                  <Coffee className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{t_label("Oziqlanish rejasi", "Озиқланиш режаси")}</span>
                </div>
                <ul className="space-y-2 text-[11px] text-slate-600 font-semibold leading-relaxed">
                  {corpRiskResult.shaxsiyTavsiyalar.ovqatlanish.map((item: string, idx: number) => (
                    <li key={idx} className="flex gap-1.5">
                      <span className="text-amber-500 font-black shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Jismoniy mashg'ulot (Workout Plan) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-indigo-950 font-black text-xs uppercase tracking-widest pb-1.5 border-b border-indigo-100">
                  <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t_label("Jismoniy faollik", "Жисмоний фаоллик")}</span>
                </div>
                <ul className="space-y-2 text-[11px] text-slate-600 font-semibold leading-relaxed">
                  {corpRiskResult.shaxsiyTavsiyalar.jismoniyMashq.map((item: string, idx: number) => (
                    <li key={idx} className="flex gap-1.5">
                      <span className="text-emerald-500 font-black shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tibbiy ko'rik va tibbiy reja */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-indigo-950 font-black text-xs uppercase tracking-widest pb-1.5 border-b border-indigo-100">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{t_label("Tibbiy-profilaktika", "Тиббий-профилактика")}</span>
                </div>
                <ul className="space-y-2 text-[11px] text-slate-600 font-semibold leading-relaxed">
                  {corpRiskResult.shaxsiyTavsiyalar.tibbiyReja.map((item: string, idx: number) => (
                    <li key={idx} className="flex gap-1.5">
                      <span className="text-blue-500 font-black shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* FIFTH BLOCK: POTENTIAL HEALTH BENEFIT SIMULATION */}
            <div className="bg-emerald-50/40 rounded-2xl border border-emerald-100 p-5 text-left space-y-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-emerald-600 shrink-0" />
                <h4 className="font-extrabold text-xs uppercase tracking-widest text-emerald-950">
                  {t_label("Sog'lom turmush tarzi natijasida kutiladigan samara:", "Соғлом турмуш тарзи натижасида кутиладиган самара:")}
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                {t_label(
                  "Agar siz yuqorida tavsiya etilgan oziqlanish munosabati, jismoniy jallolik va tibbiy profilaktika rejasiga to'liq rioya qilsangiz, yaqin muddatlarda kardiologik risk ko'rsatkichlarining o'zgarishi quyidagicha prognoz qilinadi:",
                  "Агар сиз юқорида тавсия этилган озиқланиш муносабати, жисмоний жаллик ва тиббий профилактика режасига тўлиқ риоя қилсангиз, яқин муддатларда кардиологик риск кўрсаткичларининг ўзгариши қуйидагича прогноз қилинади:"
                )}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {corpRiskResult.shaxsiyTavsiyalar.kutilayotganEffekt.map((eff: any, idx: number) => (
                  <div key={idx} className="bg-white border border-emerald-100 rounded-xl px-4 py-2.5 flex justify-between items-center shadow-sm text-left">
                    <span className="text-xs font-bold text-slate-700">{eff.ozgarish}</span>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0 ml-2">
                      -{eff.kamayadiganXavf}% risk pasayishi
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ACCREDITATION & FOOTER */}
            <div className="border-t border-slate-100 pt-6 mt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>{t_label("Ushbu hisobot raqamli ravishda imzolangan va tasdiqlangan.", "Ушбу ҳисобот рақамли равишда имзоланган ва тасдиқланган.")}</span>
              <span className="text-slate-500 font-black font-mono">ID: ERP-{Math.floor(Date.now() / 10000000)}</span>
            </div>

          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Introduction Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg md:text-xl font-black text-slate-800 leading-tight">
              {t_label("Xodimlar uchun so‘rovnoma", "Ходимлар учун сўровнома")}
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              EnergoHealth-Predict • thermal-donozolog.uz
            </p>
          </div>
        </div>

        <div className="text-slate-600 text-xs md:text-sm leading-relaxed space-y-3 font-semibold bg-slate-50 p-4 border rounded-xl">
          <p>
            {t_label(
              "Sizni korporativ xodimlar salomatligini mustahkamlash dasturlarini amalga oshirishning dastlabki bosqichi bo'lgan so'rovnomani to‘ldirishga taklif qilamiz.",
              "Сизни корпоратив ходимлар саломатлигини мустаҳкамлаш дастурларини амалга оширишнинг дастлабки босқичи бўлган сўровномани тўлдиришга таклиф қиламиз."
            )}
          </p>
          <p>
            {t_label(
              "So‘rovnomada ishtirok etish ixtiyoriy va anonimdir. Biz siz haqingizda hech qanday maxfiy ma'lumotlarni to‘plamaymiz. To‘plangan ma’lumotlar xavfsiz saqlanadi, faqat tadqiqot maqsadlarida ishlatiladi va uchinchi shaxslar bilan baham ko‘rilmaydi.",
              "Сўровномада иштирок этиш ихтиёрий ва анонимдир. Биз сиз ҳақингизда ҳеч қандай махфий маълумотларни тўпламаймиз. Тўпланган маълумотлар хавфсиз сақланади, фақат тадқиқот мақсадларида ишлатилади ва учинчи шахслар билан баҳам кўрилмайди."
            )}
          </p>
          <p>
            {t_label(
              "So‘rovnomani to‘ldirish uchun taxminiy vaqt 15-20 daqiqa. Bu test emas, shuning uchun to‘g‘ri yoki noto‘g'ri javoblar yo‘q. Iltimos, barcha savollarga iloji boricha aniq javob bering, bu juda muhim.",
              "Сўровномани тўлдириш учун тахминий вақт 15-20 дақиқа. Бу тест эмас, шунинг учун тўғри ёки нотўғри жавоблар йўқ. Илтимос, барча саволларга иложи борича аниқ жавоб беринг, бу жуда муҳим."
            )}
          </p>
        </div>

        <div className="pt-2">
          <label className="flex items-start gap-3 cursor-pointer group bg-emerald-50/50 hover:bg-emerald-50 p-4 rounded-xl border border-emerald-200 transition-colors">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(e) => setConsentAccepted(e.target.checked)}
              className="mt-1 w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span className="text-xs md:text-sm font-bold text-emerald-950">
              {t_label(
                "Yuqorida keltirilgan ma’lumotlarni tushunganimni tasdiqlayman va so‘rovnomada ixtiyoriy ravishda ishtirok etishga roziman.",
                "Юқорида келтирилган маълумотларни тушунганимни тасдиқлайман ва сўровномада ихтиёрий равишда иштирок этишга розиман."
              )}
            </span>
          </label>
        </div>
      </div>

      {consentAccepted && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          
          {/* Step indicator */}
          <div className="bg-slate-50 border-b p-4 overflow-x-auto flex justify-between gap-4">
            {stepsList.map(step => (
              <button
                key={step.num}
                type="button"
                onClick={() => setActiveStep(step.num)}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold shrink-0 transition-all ${
                  activeStep === step.num
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                }`}
              >
                {step.num}. {step.label}
              </button>
            ))}
          </div>

          <form onSubmit={validateAndSubmit} className="p-6 md:p-8 space-y-6">

            {/* SECTION 1: UMUMIY MA`LUMOTLAR */}
            {activeStep === 1 && (
              <div className="space-y-6">
                <div className="border-b pb-2">
                  <h4 className="font-extrabold text-base text-slate-800">1-bo‘lim. UMUMIY MA‘LUMOTLAR</h4>
                  <p className="text-xs text-slate-400">Demografik va kadrlar malakasi ma'lumotlari</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tashkilot nomi */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tashkilot nomi</label>
                    <input
                      type="text"
                      className="w-full text-xs rounded border p-2 bg-slate-50 focus:bg-white text-slate-800 border-slate-300"
                      value={fields.tashkilotNomi}
                      onChange={(e) => setFields({ ...fields, tashkilotNomi: e.target.value })}
                      placeholder="Masalan: Respublika Energetika Tizimi"
                      required
                    />
                  </div>

                  {/* Yoshi */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Yoshi (to‘liq yil, oy, kun)</label>
                    <input
                      type="text"
                      className="w-full text-xs rounded border p-2 bg-slate-50 focus:bg-white text-slate-800 border-slate-300"
                      value={fields.yoshi}
                      onChange={(e) => setFields({ ...fields, yoshi: e.target.value })}
                      placeholder="Masalan: 34 yosh, 1992-yil 12-may"
                      required
                    />
                  </div>

                  {/* Tana vazni */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tana vazni (kg)</label>
                    <input
                      type="number"
                      className="w-full text-xs rounded border p-2 bg-slate-50 focus:bg-white text-slate-800 border-slate-300"
                      value={fields.vazni}
                      onChange={(e) => setFields({ ...fields, vazni: e.target.value })}
                      placeholder="72"
                      required
                    />
                  </div>

                  {/* Jinsi */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Jinsingizni ko‘rsating</label>
                    <div className="flex gap-3 mt-1">
                      {['erkak', 'ayol'].map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setFields({ ...fields, jins: g as 'erkak' | 'ayol' })}
                          className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold border transition-all ${
                            fields.jins === g
                              ? 'bg-blue-50 border-blue-600 text-blue-700'
                              : 'bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {g === 'erkak' ? 'Erkak' : 'Ayol'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Oilaviy holati */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Oilaviy holati</label>
                    <select
                      value={fields.oilaviyHolat}
                      onChange={(e) => setFields({ ...fields, oilaviyHolat: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="turmush_qurmagan">Turmush qurmagan</option>
                      <option value="turmush_qurgan">Turmush qurgan</option>
                      <option value="beva">Beva</option>
                      <option value="fuqarolik_nikohi">Fuqarolik nikohi</option>
                      <option value="ajrashgan">Ajrashgan</option>
                    </select>
                  </div>

                  {/* Ma'lumot darajasi */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Iltimos, ma’lumot darajangizni ko‘rsating</label>
                    <select
                      value={fields.malumotDarajasi}
                      onChange={(e) => setFields({ ...fields, malumotDarajasi: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="boshlangich">Boshlang‘ich yoki to‘liqsiz o'rta</option>
                      <option value="toliq_orta">To'liq o'rta ma'lumot</option>
                      <option value="kasb_hunar">Kasb-hunar va o'rta ma'lumot</option>
                      <option value="oliy">Oliy ma'lumot</option>
                    </select>
                  </div>

                  {/* Kasbingiz */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Kasbingizni ko‘rsating</label>
                    <select
                      value={fields.kasbi}
                      onChange={(e) => setFields({ ...fields, kasbi: e.target.value })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white mb-2"
                    >
                      <option value="Boshqaruvchi">Boshqaruvchi</option>
                      <option value="Texnik mutaxassis">Texnik mutaxassis</option>
                      <option value="Chilangar">Chilangar</option>
                      <option value="Payvandchi">Payvandchi</option>
                      <option value="Elektromontyor">Elektromontyor</option>
                      <option value="Ishlab chiqarish ishchisi">Ishlab chiqarish ishchisi</option>
                      <option value="Laborant">Laborant</option>
                      <option value="boshqa">boshqa (yozib qo‘ying)</option>
                    </select>
                    {fields.kasbi === 'boshqa' && (
                      <input
                        type="text"
                        placeholder="Kasbingizni yozing..."
                        className="w-full text-xs rounded border p-2 bg-white text-slate-800 border-slate-300"
                        value={fields.kasbiBoshqa}
                        onChange={(e) => setFields({ ...fields, kasbiBoshqa: e.target.value })}
                      />
                    )}
                  </div>

                  {/* Sexingiz */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ish yuritayotgan sexingizni ko‘rsating</label>
                    <select
                      value={fields.sex}
                      onChange={(e) => setFields({ ...fields, sex: e.target.value })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white mb-2"
                    >
                      <option value="Qozonxona sexi">Qozonxona sexi</option>
                      <option value="Turbinalar sexi">Turbinalar sexi</option>
                      <option value="Elektr sexi">Elektr sexi</option>
                      <option value="SKT va OSDT">SKT va OSDT</option>
                      <option value="Kimyoviy sex">Kimyoviy sex</option>
                      <option value="Gaz turbina qurilmasi sexi">Gaz turbina qurilmasi sexi</option>
                      <option value="boshqa">boshqa (yozib qo‘ying)</option>
                    </select>
                    {fields.sex === 'boshqa' && (
                      <input
                        type="text"
                        placeholder="Sexingizni yozing..."
                        className="w-full text-xs rounded border p-2 bg-white text-slate-800 border-slate-300"
                        value={fields.sexBoshqa}
                        onChange={(e) => setFields({ ...fields, sexBoshqa: e.target.value })}
                      />
                    )}
                  </div>

                  {/* Staj */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Kasbingizdagi ish stajingiz</label>
                    <select
                      value={fields.ishStaji}
                      onChange={(e) => setFields({ ...fields, ishStaji: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="1_yildan_kam">Bir yildan kam</option>
                      <option value="2_to_4">2 yildan 4 yilgacha</option>
                      <option value="5_to_9">5 yildan 9 yilgacha</option>
                      <option value="10_to_14">10 yildan 14 yilgacha</option>
                      <option value="15_to_19">15 yildan 19 yilgacha</option>
                      <option value="20_va_katta">20 yil va undan katta</option>
                    </select>
                  </div>

                  {/* Ish tartibi */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ish tartibiz</label>
                    <select
                      value={fields.ishTartibi}
                      onChange={(e) => setFields({ ...fields, ishTartibi: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="kunduzgi">Kunduzgi</option>
                      <option value="smenali">Smenali</option>
                      <option value="tungi">Tungi smena mavjud</option>
                    </select>
                  </div>

                </div>
              </div>
            )}

            {/* SECTION 2: MEHNAT SHAROITLARI */}
            {activeStep === 2 && (
              <div className="space-y-6">
                <div className="border-b pb-2">
                  <h4 className="font-extrabold text-base text-slate-800">2-bo‘lim. MEHNAT SHAROITLARI</h4>
                  <p className="text-xs text-slate-400">Ish joyi ziyonli omillari va asabiy zo'riqishlar</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Shovqin */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ish joyingizda shovqin darajasi qanday?</label>
                    <div className="flex gap-2.5 mt-1">
                      {['past', 'ortacha', 'yuqori'].map(sh => (
                        <button
                          key={sh}
                          type="button"
                          onClick={() => setFields({ ...fields, shovqinDarajasi: sh as any })}
                          className={`flex-1 py-2 px-3 text-xs font-bold border rounded-lg transition-all ${
                            fields.shovqinDarajasi === sh
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {sh === 'past' ? 'Past' : sh === 'ortacha' ? 'O\'rtacha' : 'Yuqori'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Harorat */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ish jarayonida yuqori harorat ta’sir bormi?</label>
                    <div className="flex gap-2.5 mt-1">
                      {['ha', 'yoq'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFields({ ...fields, yuqoriHarorat: t as any })}
                          className={`flex-1 py-2 px-3 text-xs font-bold border rounded-lg transition-all ${
                            fields.yuqoriHarorat === t
                              ? 'bg-orange-650 text-white shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {t === 'ha' ? 'Ha' : 'Yo\'q'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Himoya vositalari */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Shaxsiy himoya vositalaridan (niqob, qo'lqop va h.k.) foydalanasizmi?</label>
                    <select
                      value={fields.himoyaVositalari}
                      onChange={(e) => setFields({ ...fields, himoyaVositalari: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="doim">Doim</option>
                      <option value="bazan">Ba'zan</option>
                      <option value="umuman">Umuman yo'q</option>
                    </select>
                  </div>

                  {/* Yangi organish */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ishlayotganingizda yangi narsalarni o'rganish imkoniyati bormi?</label>
                    <select
                      value={fields.yangiOrganish}
                      onChange={(e) => setFields({ ...fields, yangiOrganish: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="juda_katta">Juda katta darajada</option>
                      <option value="katta">Katta darajada</option>
                      <option value="malum">Ma'lum darajada</option>
                      <option value="kichik">Kichik darajada</option>
                      <option value="juda_kichik">Juda kichik darajada</option>
                    </select>
                  </div>

                  {/* Ish muhimligi */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ish joyingiz siz uchun muhimmi?</label>
                    <select
                      value={fields.ishMuhimligi}
                      onChange={(e) => setFields({ ...fields, ishMuhimligi: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="juda_katta">Juda katta darajada</option>
                      <option value="katta">Katta darajada</option>
                      <option value="malum">Ma'lum darajada</option>
                      <option value="kichik">Kichik darajada</option>
                      <option value="juda_kichik">Juda kichik darajada</option>
                    </select>
                  </div>

                  {/* Ishdan qoniqish */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Barcha omillarni hisobga olgan holda, ishingizdan qoniqasizmi?</label>
                    <select
                      value={fields.ishdanQoniqish}
                      onChange={(e) => setFields({ ...fields, ishdanQoniqish: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="juda_qoniqaman">Juda qoniqaman</option>
                      <option value="qoniqardim">Qoniqardim</option>
                      <option value="qoniqarsiz">Qoniqarsiz</option>
                      <option value="juda_noroziman">Juda noroziman</option>
                    </select>
                  </div>

                  {/* Ish salbiy energiya */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ishingiz hayotingizga salbiy ta'sir ko'rsatadigan darajada ko'p energiyangizni olyaptimi?</label>
                    <select
                      value={fields.ishSalbiyEnergiya}
                      onChange={(e) => setFields({ ...fields, ishSalbiyEnergiya: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="ha_malum">Ha, ma'lum darajada</option>
                      <option value="ha_ozgina">Ha, lekin ozgina</option>
                      <option value="yoq">Yo'q, umuman yo'q</option>
                    </select>
                  </div>

                  {/* Jismoniy charchoq */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">So'nggi 4 hafta ichida qanchalik tez-tez jismoniy charchoqni his qildingiz?</label>
                    <select
                      value={fields.jismoniyCharchoq}
                      onChange={(e) => setFields({ ...fields, jismoniyCharchoq: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="doim">Doim</option>
                      <option value="kopincha">Ko'pincha</option>
                      <option value="bazan">Ba'zan</option>
                      <option value="ozgina">Vaqtning ozgina qismi</option>
                      <option value="umuman_yoq">Umuman yo'q</option>
                    </select>
                  </div>

                  {/* Asabiylashish */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">So'nggi 4 hafta ichida qanchalik tez-tez asabiylashdingiz?</label>
                    <select
                      value={fields.asabiylashish}
                      onChange={(e) => setFields({ ...fields, asabiylashish: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="doim">Doim</option>
                      <option value="kopincha">Ko'pincha</option>
                      <option value="bazan">Ba'zan</option>
                      <option value="ozgina">Ozgina vaqt</option>
                      <option value="umuman_yoq">Umuman yo'q</option>
                    </select>
                  </div>

                  {/* Tik oyoqda soat */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Smenangiz davomida o‘rtacha necha soatni tik oyoqda yoki noqulay holatda o‘tkazasiz?</label>
                    <input
                      type="text"
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                      value={fields.tikOyoqdaSoat}
                      onChange={(e) => setFields({ ...fields, tikOyoqdaSoat: e.target.value })}
                      placeholder="Masalan: 6 soat"
                    />
                  </div>
                </div>

                {/* Multiple choices: Tashvishlar */}
                <div className="bg-slate-50 p-4 border rounded-xl space-y-2">
                  <span className="block text-xs font-bold text-slate-700">Ish joyida sizni eng ko'p tashvishga soladigan narsa (bir nechta javoblar bo‘lishi mumkin):</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                    {[
                      "Noqulay mikroiqlim",
                      "O‘g'irlik joyidan uzoqlik",
                      "Yorug'likning yetarli emasligi",
                      "Ish joyida tik turish",
                      "Shovqin darajasi",
                      "Bir xillik va takrorlanish",
                      "Jismoniy zo'riqish",
                      "Chang",
                      "Noxush hidlar",
                      "Doimiy stress",
                      "Noqulay ish joyi",
                      "Ikki smenali ish",
                      "Qo'shimcha ish vaqti",
                      "Shaxsiy himoya vositalarining yo'qligi",
                      "Kimyoviy moddalar bilan ishlash",
                      "Hammasi joyida"
                    ].map(opt => {
                      const checked = fields.tashvishlar.includes(opt);
                      return (
                        <label key={opt} className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleCheckboxChange('tashvishlar', opt)}
                            className="mt-0.5 w-4 h-4 text-blue-600 rounded"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Open questions section 2 */}
                <div className="bg-white p-4 border border-slate-200 rounded-xl space-y-4">
                  <span className="block text-xs font-extrabold text-blue-800 uppercase tracking-widest border-b pb-1">Semptomatik va somatik holat kuzatuvlari</span>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Keyingi paytlarda uyqungizda o‘zgarishlar bo‘ldimi? (Uxlashga qiynalish, tunda tez-tez uyg‘onish, uyquga to‘ymaslik)</label>
                      <textarea
                        className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white h-16"
                        value={fields.uyquOzgarishlar}
                        onChange={(e) => setFields({ ...fields, uyquOzgarishlar: e.target.value })}
                        placeholder="Batafsil yozing..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Ish vaqtida to‘satdan yurak urib ketishi, havoning yetishmasligi yoki bosh aylanishi holatlari kuzatiladimi?</label>
                      <textarea
                        className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white h-16"
                        value={fields.yurakUrishiBoshAylanish}
                        onChange={(e) => setFields({ ...fields, yurakUrishiBoshAylanish: e.target.value })}
                        placeholder="O'zgarishlar bormi..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Ishdagi mas'uliyat va xavf darajasi sababli doimiy xavotir yoki qo‘rquv hissi bormi?</label>
                      <textarea
                        className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white h-16"
                        value={fields.stressXavotirQorgu}
                        onChange={(e) => setFields({ ...fields, stressXavotirQorgu: e.target.value })}
                        placeholder="Doimiy yuklama va uning ruhiy bosimi..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Ish joyida yoki undan tashqarida sababsiz quruq yo‘tal, tomoq qichishishi yoki nafas qisishi bezovta qiladimi?</label>
                      <textarea
                        className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white h-16"
                        value={fields.quruqYotalNafasQisishi}
                        onChange={(e) => setFields({ ...fields, quruqYotalNafasQisishi: e.target.value })}
                        placeholder="Chang yoki bug'lanish bilan bog'liq shikoyat..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Ishdan keyin bel, bo‘yin yoki oyoq mushaklarida simillagan og‘riqlar, qotib qolishlar bo‘ladimi?</label>
                      <textarea
                        className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white h-16"
                        value={fields.mushaklarOgriq}
                        onChange={(e) => setFields({ ...fields, mushaklarOgriq: e.target.value })}
                        placeholder="Simillab og'rishlar borligi..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Quloqlarda shang‘illash (ayniqsa ishdan keyin tinch joyda) yoki ko‘z oldi xiralashishi, ko‘z yoshlanishi bormi?</label>
                      <textarea
                        className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white h-16"
                        value={fields.quloqShangillashKoziXiralashish}
                        onChange={(e) => setFields({ ...fields, quloqShangillashKoziXiralashish: e.target.value })}
                        placeholder="Shovqin darajasi va asoratlari..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Ishtahaning bo‘g‘ilishi, jig‘ildon qaynashi yoki oshqozondagi noqulayliklar ish jadvali (smenalar almashishi) bilan bog‘liqmi?</label>
                      <textarea
                        className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white h-16"
                        value={fields.ishtahaBogliqlik}
                        onChange={(e) => setFields({ ...fields, ishtahaBogliqlik: e.target.value })}
                        placeholder="Gazopatiyalik alomatlari..."
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* SECTION 3: JISMONIY SALOMATLIK HOLATI */}
            {activeStep === 3 && (
              <div className="space-y-6">
                <div className="border-b pb-2">
                  <h4 className="font-extrabold text-base text-slate-800">3-Bo‘lim. JISMONIY SALOMATLIK HOLATI</h4>
                  <p className="text-xs text-slate-400">Kasallik anamnezi va tibbiy ko'riklardan o'tish ko'rsatkichlari</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Sog'lik bahosi */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Sog‘lig'ingizni qanday baholaysiz?</label>
                    <select
                      value={fields.soglikBahosi}
                      onChange={(e) => setFields({ ...fields, soglikBahosi: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="yaxshi">Yaxshi</option>
                      <option value="ortacha">O'rtacha</option>
                      <option value="yomon">Yomon</option>
                      <option value="bilmayman">Bilmayman</option>
                    </select>
                  </div>

                  {/* Muntazam tibbiy korik */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Muntazam tibbiy ko'rikdan o'tasizmi?</label>
                    <select
                      value={fields.tibbiyKorikMuntazam}
                      onChange={(e) => setFields({ ...fields, tibbiyKorikMuntazam: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="ha">Ha</option>
                      <option value="yoq">Yo'q</option>
                      <option value="bilmayman">Bilmayman</option>
                    </select>
                  </div>

                  {/* 2 yilda tibbiy korik */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">So‘nggi ikki yil ichida profilaktik tibbiy ko‘rikdan o‘tdingizmi?</label>
                    <select
                      value={fields.profilaktikKorikIkkiYil}
                      onChange={(e) => setFields({ ...fields, profilaktikKorikIkkiYil: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="ha">Ha</option>
                      <option value="yoq">Yo'q</option>
                      <option value="bilmayman">Bilmayman</option>
                    </select>
                  </div>

                  {/* Qon bosimini biladimi */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Qon bosimingizni bilasizmi?</label>
                    <select
                      value={fields.qonBosiminiBiladimi}
                      onChange={(e) => setFields({ ...fields, qonBosiminiBiladimi: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white mb-2"
                    >
                      <option value="ha">Ha</option>
                      <option value="yoq">Yo'q</option>
                    </select>
                    {fields.qonBosiminiBiladimi === 'ha' && (
                      <input
                        type="text"
                        placeholder="Qon bosimingizni kiriting (Masalan: 120/80)"
                        className="w-full text-xs rounded border p-2 bg-white text-slate-800 border-slate-300"
                        value={fields.qonBosimiQiymati}
                        onChange={(e) => setFields({ ...fields, qonBosimiQiymati: e.target.value })}
                      />
                    )}
                  </div>

                  {/* Gripp emlanish */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">O‘tgan yili grippga qarshi emlanganmisiz?</label>
                    <select
                      value={fields.grippEmlash}
                      onChange={(e) => setFields({ ...fields, grippEmlash: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="har_yili">Ha, men har yili emlanaman</option>
                      <option value="kamdan_kam">Ha, lekin kamdan-kam hollarda emlanaman</option>
                      <option value="yoq">Yo‘q</option>
                      <option value="boshqa">Boshqa</option>
                    </select>
                  </div>

                  {/* Surunkali kasallik */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Sizda shifokor tomonidan aniqlangan surunkali kasallik bormi?</label>
                    <select
                      value={fields.surunkaliKasallik}
                      onChange={(e) => setFields({ ...fields, surunkaliKasallik: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white mb-2"
                    >
                      <option value="ha">Ha</option>
                      <option value="yoq">Yo‘q</option>
                    </select>
                    {fields.surunkaliKasallik === 'ha' && (
                      <input
                        type="text"
                        placeholder="Kasallik nomini yozing..."
                        className="w-full text-xs rounded border p-2 bg-white text-slate-800 border-slate-300"
                        value={fields.surunkaliKasallikNomi}
                        onChange={(e) => setFields({ ...fields, surunkaliKasallikNomi: e.target.value })}
                      />
                    )}
                  </div>

                  {/* Salbiy ta'sir ko'rsatyaptimi tibbiy faoliyat */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ish faoliyatingiz salomatligingizga salbiy ta’sir ko‘rsatmoqda deb hisoblaysizmi?</label>
                    <select
                      value={fields.ishSalbiySoglik}
                      onChange={(e) => setFields({ ...fields, ishSalbiySoglik: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="ha">Ha</option>
                      <option value="qisman">Qisman</option>
                      <option value="yoq">Yo‘q</option>
                    </select>
                  </div>

                  {/* Sport zali */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Sport uchun taqdim etilgan inshootlardan/sharoitlardan foydalanasizmi?</label>
                    <select
                      value={fields.sportZalFoydalanish}
                      onChange={(e) => setFields({ ...fields, sportZalFoydalanish: e.target.value })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="ha, Jihozlangan sport zalidan">Ha, Jihozlangan sport zalidan</option>
                      <option value="Guruh mashg'ulotlari (yoga va boshqalar)">Guruh mashg'ulotlari (yoga va boshqalar)</option>
                      <option value="Yo'q">Yo'q</option>
                      <option value="Sport inshootlari yo'q">Sport inshootlari yo'q</option>
                      <option value="Boshqa">Boshqa</option>
                    </select>
                  </div>

                  {/* Yo'llanmalar */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tashkilotingiz sizga sog‘liqni saqlash markazlari yoki dam olish uylariga yo‘llanmalar beradimi?</label>
                    <select
                      value={fields.vaucherBerilishi}
                      onChange={(e) => setFields({ ...fields, vaucherBerilishi: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white mb-2"
                    >
                      <option value="ha">Ha</option>
                      <option value="yoq">Yo‘q</option>
                    </select>
                    {fields.vaucherBerilishi === 'ha' && (
                      <select
                        value={fields.vaucherMoliyalashtirish}
                        onChange={(e) => setFields({ ...fields, vaucherMoliyalashtirish: e.target.value as any })}
                        className="w-full text-xs rounded border p-2 bg-white text-slate-800 border-slate-300"
                      >
                        <option value="">-- Moliyalashtirish qanday bo'ldi? --</option>
                        <option value="to`liq_o`z_hisobidan">To‘liq o'z hisobingizdan</option>
                        <option value="to`liq_tashkilot_hisobidan">To‘liq tashkilot hisobidan</option>
                        <option value="qisman_o`z_hisobidan">Qisman o‘z hisobingizdan (tashkilot qo‘shimcha mablag‘ ajratdi)</option>
                      </select>
                    )}
                  </div>

                  {/* Jamoaviy shartnoma */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Jamoaviy shartnomani bajarilishi sizni qoniqtiradimi?</label>
                    <select
                      value={fields.jamoaviyShartnomaQoniqish}
                      onChange={(e) => setFields({ ...fields, jamoaviyShartnomaQoniqish: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="ha">Ha, qoniqaman</option>
                      <option value="yoq">Yo‘q, noroziman</option>
                    </select>
                  </div>
                </div>

                {/* Checklist: Sog'liqdagi buzilishlar */}
                <div className="bg-slate-50 p-4 border rounded-xl space-y-2">
                  <span className="block text-xs font-bold text-slate-700">So‘nggi 6 oyda quyidagi holatlar sizda kuzatilganmi? (bir nechta javob belgilash mumkin):</span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                    {[
                      "Bosh og‘rig‘i",
                      "Yurak urishining tezlashishi",
                      "Nafas qisishi",
                      "Bel yoki bo‘g‘im og‘riqlari",
                      "Tez charchash",
                      "Kuzatilmagan"
                    ].map(h => (
                      <label key={h} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fields.songgiOltiOyHolatlar.includes(h)}
                          onChange={() => handleCheckboxChange('songgiOltiOyHolatlar', h)}
                          className="w-4 h-4 text-emerald-600 rounded"
                        />
                        <span>{h}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Checklist: Kasalliklar turi */}
                <div className="bg-slate-50 p-4 border rounded-xl space-y-2">
                  <span className="block text-xs font-bold text-slate-700">So‘ngi bir yil ichida qanday kasalliklar bilan ko‘proq kasallandingiz? (bir nechta javob mumkin):</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {[
                      "Yurak-qon tomir tizimi kasalliklari",
                      "Yuqori va quyi nafas organlari kasalliklari",
                      "Nerv sistemasi kasalliklari",
                      "Buyrak kasalliklari"
                    ].map(k => (
                      <label key={k} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fields.birYilKasalliklar.includes(k)}
                          onChange={() => handleCheckboxChange('birYilKasalliklar', k)}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <span>{k}</span>
                      </label>
                    ))}
                    <div className="col-span-1 md:col-span-2 space-y-1">
                      <span className="text-[11px] font-bold text-slate-500 block">Boshqa (yozib qo‘ying):</span>
                      <input
                        type="text"
                        className="w-full text-xs rounded border p-2 bg-white text-slate-800 border-slate-300"
                        value={fields.birYilKasalliklarBoshqa}
                        onChange={(e) => setFields({ ...fields, birYilKasalliklarBoshqa: e.target.value })}
                        placeholder="Kasallik nomlari..."
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* SECTION 4: HAYOT TARZI */}
            {activeStep === 4 && (
              <div className="space-y-6">
                <div className="border-b pb-2">
                  <h4 className="font-extrabold text-base text-slate-800">4-Bo‘lim. HAYOT TARZI</h4>
                  <p className="text-xs text-slate-400">Zararli odatlar va jismoniy faollik ko'rsatkichi</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Sigaret */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Hozirda sigaret, tamaki mahsulotlaridan foydalanasizmi?</label>
                    <select
                      value={fields.tamakiFoydalanish}
                      onChange={(e) => setFields({ ...fields, tamakiFoydalanish: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="hech_qachon">Hech qachon chekmaganman</option>
                      <option value="ilgari_chekkan">Ilgari chekardim, lekin tashladim</option>
                      <option value="hozir_chekadi">Hozirda chekaman</option>
                    </select>
                  </div>

                  {/* Sport shug'ullanish */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Jismoniy mashqlar yoki sport bilan shug‘ullanasizmi (ertalabki mashqlarni ham qo‘shgan holda)?</label>
                    <select
                      value={fields.sportShugullanish}
                      onChange={(e) => setFields({ ...fields, sportShugullanish: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="muntazam_yoki_vaqti_vaqti">Ha, muntazam ravishda yoki vaqti-vaqti bilan mashq qilaman</option>
                      <option value="yoq_lekin_xohlardi">Yo‘q, lekin xohlardim</option>
                      <option value="yoq_va_xohlamasdi">Yo‘q va xohlamasdim</option>
                    </select>
                  </div>
                </div>

                {/* Shug'ullanmaydiganlar uchun savol */}
                {fields.sportShugullanish !== 'muntazam_yoki_vaqti_vaqti' && (
                  <div className="bg-amber-50/50 p-4 border border-amber-200 rounded-xl space-y-2">
                    <span className="block text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      3-bo'lim (Davomi). Jismoniy mashqlar bilan shug‘ullanmaydigan xodimlar uchun:
                    </span>
                    <span className="text-[11px] text-slate-600 block font-semibold">Nima uchun jismoniy mashqlar bilan shug‘ullanmaysiz? (bir nechta variant tanlash mumkin)</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {[
                        "Men bunga ehtiyoj yoki zarurat sezmayman; menga bu kerak emas.",
                        "Menda iroda yetishmaydi; o‘zimni bunga majburlay olmayman.",
                        "Sport bilan shug‘ullanishga vaqtim yo'q.",
                        "Sog‘lig'im bunga yo‘l qo‘ymaydi.",
                        "Sport bilan shug‘ullanishga pulim yo'q.",
                        "Qo‘lim yetadigan joyda sport inshootlari, o‘yin maydonchalari yo‘q.",
                        "Mening suhbatdoshlarim yo'q va yolg‘iz qolish qiziq emas.",
                        "Men qanday qilib to‘g'ri mashq qilishni bilmayman.",
                        "Boshqa"
                      ].map(sabab => (
                        <label key={sabab} className="flex items-start gap-2 text-xs text-slate-750 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={fields.sportShugullanmaslikSabablar.includes(sabab)}
                            onChange={() => handleCheckboxChange('sportShugullanmaslikSabablar', sabab)}
                            className="mt-0.5 w-4 h-4 text-amber-600 rounded"
                          />
                          <span>{sabab}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shug'ullanadiganlar uchun savol */}
                {fields.sportShugullanish === 'muntazam_yoki_vaqti_vaqti' && (
                  <div className="bg-emerald-50/50 p-4 border border-emerald-200 rounded-xl space-y-4">
                    <span className="block text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Dribbble className="w-4 h-4 text-emerald-600" />
                      4-bo'lim (Davomi). Sport bilan shug‘ullanadigan xodimlar uchun:
                    </span>

                    <div className="space-y-4">
                      {/* Qaysi sport turlari */}
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 block mb-2">Hozirda qaysi sport turlari bilan shug'ullanasiz? (bir nechta javob tanlash mumkin):</span>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                          {[
                            "Yengil atletika, yugurish",
                            "Sog‘lomlashtirish yurishi",
                            "Mashq (gorizontal turnik)",
                            "Sport zali",
                            "Suzish / suv sportlari",
                            "Jamoayiy o'yinlar",
                            "Kurash / jang san'ati",
                            "Gimnastika / akrobatika",
                            "Velosipedda yurish",
                            "Shaxmat / shashka",
                            "Tennis / stol tennisi",
                            "Boshqa"
                          ].map(sp => (
                            <label key={sp} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={fields.sportTurlari.includes(sp)}
                                onChange={() => handleCheckboxChange('sportTurlari', sp)}
                                className="w-4 h-4 text-emerald-600 rounded"
                              />
                              <span>{sp}</span>
                            </label>
                          ))}
                        </div>
                        {fields.sportTurlari.includes('Boshqa') && (
                          <input
                            type="text"
                            placeholder="Zarur bo'lsa boshqa sport turlarini yozing..."
                            className="w-full text-xs rounded border p-2 bg-white text-slate-800 border-slate-300 mt-2"
                            value={fields.sportTurlariBoshqa}
                            onChange={(e) => setFields({ ...fields, sportTurlariBoshqa: e.target.value })}
                          />
                        )}
                      </div>

                      {/* Qanchalik tez-tez */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Qanchalik tez-tez mashq qilasiz?</label>
                        <select
                          value={fields.mashqTezligi}
                          onChange={(e) => setFields({ ...fields, mashqTezligi: e.target.value as any })}
                          className="w-full text-xs rounded border p-2 bg-white text-slate-800 border-slate-300"
                        >
                          <option value="">-- Tanlang --</option>
                          <option value="har_kuni">Har kuni</option>
                          <option value="haftada_bir_necha">Haftada bir necha marta</option>
                          <option value="haftada_1_2">Haftada 1-2 marta</option>
                          <option value="dam_olish">Asosan dam olish kunlari mashq qilaman</option>
                          <option value="vaqti_vaqti">Vaqti-vaqti bilan, tartibsiz, tanaffuslar bilan</option>
                          <option value="mavsumiy">Mavsmiy sport bilan shug‘ullanaman</option>
                          <option value="boshqa">Boshqa</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* SECTION 5: TIBBIY XIZMAT, PSIXOLOGIK HOLAT VA PROFILAKTIVA */}
            {activeStep === 5 && (
              <div className="space-y-6">
                <div className="border-b pb-2">
                  <h4 className="font-extrabold text-base text-slate-800">5-Bo‘lim. Tibbiy xizmat, psixologik holat va profilaktika</h4>
                  <p className="text-xs text-slate-400">Korporativ sog'liqni saqlash sifati va ish stressi darajasi</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tibbiy yordam yetarli */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ish joyingizda tibbiy yordam yetarli darajada ta’minlanganmi?</label>
                    <select
                      value={fields.tibbiyYordamYetarliligi}
                      onChange={(e) => setFields({ ...fields, tibbiyYordamYetarliligi: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="ha">Ha</option>
                      <option value="qisman">Qisman</option>
                      <option value="yoq">Yo‘q</option>
                    </select>
                  </div>

                  {/* Kasbga bog'liq kasallik */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tibbiy ko‘rikdan o‘tganingizda biror ish sharoitingizga bog‘liq kasallik aniqlanganmi?</label>
                    <div className="flex gap-2.5 mt-1">
                      {['ha', 'yoq'].map(k => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setFields({ ...fields, kasbgaBoglikKasallikAniqlanganmi: k as any })}
                          className={`flex-1 py-2 px-3 text-xs font-bold border rounded-lg transition-all ${
                            fields.kasbgaBoglikKasallikAniqlanganmi === k
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {k === 'ha' ? 'Ha' : 'Yo\'q'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sog'lom turmush tarzi imkoniyati */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ish jarayonida sog‘lom turmush tarziga rioya qilish imkoniyati bormi?</label>
                    <select
                      value={fields.soglomTurmushImkoniyat}
                      onChange={(e) => setFields({ ...fields, soglomTurmushImkoniyat: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="ha">Ha</option>
                      <option value="qisman">Qisman</option>
                      <option value="yoq">Yo‘q</option>
                    </select>
                  </div>

                  {/* Ish stresslimi */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ish faoliyatingiz stressli deb hisoblaysizmi?</label>
                    <select
                      value={fields.ishStresslimi}
                      onChange={(e) => setFields({ ...fields, ishStresslimi: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="ha">Ha</option>
                      <option value="bazan">Ba’zan</option>
                      <option value="yoq">Yo‘q</option>
                    </select>
                  </div>

                  {/* Dam olishga vaqt */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ishdan keyin dam olishga yetarli vaqtingiz bormi?</label>
                    <div className="flex gap-2.5 mt-1">
                      {['ha', 'yoq'].map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setFields({ ...fields, damOlishgaVaqt: d as any })}
                          className={`flex-1 py-2 px-3 text-xs font-bold border rounded-lg transition-all ${
                            fields.damOlishgaVaqt === d
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {d === 'ha' ? 'Ha' : 'Yo\'q'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* SECTION 6: OVQATLANISH */}
            {activeStep === 6 && (
              <div className="space-y-6">
                <div className="border-b pb-2">
                  <h4 className="font-extrabold text-base text-slate-800">6-Bo‘lim. Ovqatlanish</h4>
                  <p className="text-xs text-slate-400">Ish kunlaridagi ovqatlanish ratsioni, vaqti va tuz iste'moli tahlili</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Oziqlanish */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Odatda ish kunlari qanday ovqatlanasiz?</label>
                    <select
                      value={fields.ishKuniOziqlanish}
                      onChange={(e) => setFields({ ...fields, ishKuniOziqlanish: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="uydan_olib_keladi">Uydan ovqat olib kelaman</option>
                      <option value="oshxona_kafe">Kompaniya hududidagi oshxona/kafega boraman</option>
                      <option value="uyda_nonushta_tushlik">Uyda nonushta va tushlik qilaman</option>
                      <option value="dokondan_sotib_oladi">Do'kondan ovqat sotib olaman</option>
                      <option value="tushliksiz">Tushlikni o'tkazib yuboraman</option>
                      <option value="boshqa">Boshqa</option>
                    </select>
                  </div>

                  {/* Oshxona tashrif */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Joylashgan oshxona(kafe)ga qanchalik tez-tez borasiz (agar mavjud bo'lsa)?</label>
                    <select
                      value={fields.oshxonagaTashrif}
                      onChange={(e) => setFields({ ...fields, oshxonagaTashrif: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="har_kuni">Men har kuni yoki deyarli har kuni tashrif buyuraman</option>
                      <option value="vaqti_vaqti">Men vaqti-vaqti bilan, hech bo'lmaganda ba'zan tashrif buyuraman</option>
                      <option value="deyarli_bormaydi">Men tashrif buyurmayman yoki deyarli hech qachon tashrif buyurmayman</option>
                    </select>
                  </div>

                  {/* Ovqatlanish soni */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Kuniga necha marta ovqatlanasiz?</label>
                    <select
                      value={fields.kunlikOziqlanishSoni}
                      onChange={(e) => setFields({ ...fields, kunlikOziqlanishSoni: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="2">2 marta</option>
                      <option value="3">3 marta</option>
                      <option value="4">4 marta</option>
                      <option value="boshqa">boshqa</option>
                    </select>
                  </div>

                  {/* Non turi */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ko'pincha qanday non yeysiz?</label>
                    <select
                      value={fields.nonTuri}
                      onChange={(e) => setFields({ ...fields, nonTuri: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="qora">qora non</option>
                      <option value="oq">oq non</option>
                      <option value="kepakli">kepak va boshqa qo'shimchalar qo‘shilgan non</option>
                    </select>
                  </div>

                  {/* Tuz qoshish */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tayyor ovqatga tuz qo'shasizmi?</label>
                    <select
                      value={fields.tuzQoshish}
                      onChange={(e) => setFields({ ...fields, tuzQoshish: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="yoq">Yo'q, qo'shmayman</option>
                      <option value="tatib_korib_kam_bolsa">Ha, avval tatib ko'raman kam bo‘lsa</option>
                      <option value="tatib_kormay_qoshadi">Ha, tatib ko'rmayman lekin qo‘shaman</option>
                    </select>
                  </div>

                  {/* Suv iste'moli */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Kuniga qancha miqdorda suv iste’mol qilasiz?</label>
                    <select
                      value={fields.kunlikSuvMiqdori}
                      onChange={(e) => setFields({ ...fields, kunlikSuvMiqdori: e.target.value as any })}
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white"
                    >
                      <option value="yetarli">yetarli miqdorda</option>
                      <option value="kam">kam miqdorda</option>
                      <option value="ota_kam">o‘ta kam miqdorda</option>
                      <option value="kop">ko‘p miqdorda</option>
                    </select>
                  </div>
                </div>

                {/* Checklist: Oshxonaga bormaslik sabablari */}
                {fields.oshxonagaTashrif === 'deyarli_bormaydi' && (
                  <div className="bg-slate-50 p-4 border rounded-xl space-y-2">
                    <span className="block text-xs font-bold text-slate-700">Nima uchun siz ishlaydigan tashkilot hududida joylashgan oshxona(kafe)ga bormaysiz? (bir nechta javob tanlanishi mumkin):</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {[
                        "Kafeda yuqori narxlar, qimmat",
                        "Ovqatdan norozi (sifat / xilma-xillik / taomlarning ta'mi)",
                        "Noqulay (piyoda yurish uchun uzoq / uzun navbatlar / noqulay ish jadvali)",
                        "Kafedagi muhitdan norozi (qulaylik / gigiena / xizmat ko'rsatish sifati)",
                        "Boshqa"
                      ].map(sbb => (
                        <label key={sbb} className="flex items-center gap-2 text-xs text-slate-705 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={fields.oshxonagaBormaslikSabablar.includes(sbb)}
                            onChange={() => handleCheckboxChange('oshxonagaBormaslikSabablar', sbb)}
                            className="w-4 h-4 text-emerald-600 rounded"
                          />
                          <span>{sbb}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* SECTION 7: TAKLIFLAR & IMZO */}
            {activeStep === 7 && (
              <div className="space-y-6">
                <div className="border-b pb-2">
                  <h4 className="font-extrabold text-base text-slate-800">7. TAKLIFLAR VA TASDIQLASH</h4>
                  <p className="text-xs text-slate-400">Tashkilotda ijobiy tibbiy iqlimni yaratish bo'yicha mustaqil takliflaringiz</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">1. Ish joyingizda qanday sog'liqni saqlashni rivojlantirish dasturlarida ishtirok etishni xohlaysiz va qanday xizmatlarning amalga oshirilishini ko'rishni xohlaysiz?</label>
                    <textarea
                      className="w-full text-xs rounded border p-3 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white h-24 font-semibold"
                      value={fields.sogliqniSaqlashTakliflar}
                      onChange={(e) => setFields({ ...fields, sogliqniSaqlashTakliflar: e.target.value })}
                      placeholder="Ushbu maydonga maslahat, sanatoriya, sport musobaqalari yoki emlash g'oyalarini yozing..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">2. Ish sharoitingizni yanada yaxshilash uchun shaxsiy taklifingiz?</label>
                    <textarea
                      className="w-full text-xs rounded border p-3 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white h-24 font-semibold"
                      value={fields.sharoitYaxshilashTakliflar}
                      onChange={(e) => setFields({ ...fields, sharoitYaxshilashTakliflar: e.target.value })}
                      placeholder="Havoni tozalash, shovqindan himoyalash, o'rindiq quvvatlagichlari yoki mikroiqlim haqida..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Idoraviy Tasdiq (Sex boshlig‘i imzo ismi):</label>
                    <input
                      type="text"
                      className="w-full text-xs rounded border p-2 bg-slate-50 text-slate-800 border-slate-300 focus:bg-white font-mono"
                      value={fields.sexBoshligiImzo}
                      onChange={(e) => setFields({ ...fields, sexBoshligiImzo: e.target.value })}
                      placeholder="Sex boshlig'i lavozimi va ism-familiyasi (Imzo o'rniga)"
                    />
                  </div>
                </div>

                <div className="bg-slate-550/5 border border-slate-200 rounded-xl p-4 text-center mt-6 text-slate-500 text-xs space-y-1">
                  <p className="font-extrabold uppercase text-[10px] tracking-wider text-slate-700">Tadqiqotchi hamkorlar:</p>
                  <p className="font-black text-slate-655 text-[11px]">EnergoHealth-Predict • energohealth-predict.uz • thermal-donozolog.uz</p>
                </div>

                {/* Bottom submit button */}
                <div className="pt-4 border-t flex justify-end">
                  <button
                    type="submit"
                    className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <FileSignature className="w-5 h-5" />
                    <span>ANKETANI SERVERGA JO'NATISH</span>
                  </button>
                </div>

              </div>
            )}

            {/* Pagination Controls */}
            <div className="mt-8 pt-4 border-t flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (activeStep > 1) setActiveStep(activeStep - 1);
                }}
                disabled={activeStep === 1}
                className={`px-4 py-2 text-xs font-extrabold rounded-lg border transition-all ${
                  activeStep === 1
                    ? 'opacity-35 cursor-not-allowed text-slate-400 border-slate-200'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 cursor-pointer'
                }`}
              >
                ← Ortga
              </button>

              <span className="text-xs font-extrabold text-slate-500">
                {activeStep} / 7 ({Math.round((activeStep / 7) * 100)}%)
              </span>

              {activeStep < 7 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep(activeStep + 1)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-lg cursor-pointer"
                >
                  Keyingisi →
                </button>
              ) : (
                <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest leading-loose">
                  Jo'natishga tayyor!
                </span>
              )}
            </div>

          </form>

        </div>
      )}

    </div>
  );
}
