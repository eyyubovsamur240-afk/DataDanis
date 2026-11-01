// All interface text. Azerbaijani first, English second.
import type { Lang } from "./catalog";
import type { Failure } from "./executor";

export const UI = {
  az: {
    tagline: "Azərbaycanın açıq dövlət statistikası haqqında sualınızı sadə dildə verin — cavab, qrafik və mənbə alın.",
    how1: "Sualınızı yazın (azərbaycanca və ya ingiliscə).",
    how2: "Süni intellekt uyğun rəsmi cədvəli seçir; rəqəmləri kod hesablayır.",
    how3: "Qısa cavab, qrafik və opendata.az mənbə linki alırsınız.",
    examples: "Nümunə suallar",
    placeholder: "Məsələn: Son 10 ildə inflyasiya necə dəyişib?",
    ask: "Soruş",
    thinking: "Cavab hazırlanır…",
    source: "Mənbə",
    dataAsOf: "Məlumatlar yüklənib",
    showTable: "Cədvəli göstər",
    year: "İl",
    datasetsTitle: "Hazırda mövcud olan məlumatlar",
    privacyTitle: "Məxfilik",
    privacy:
      "Hesab və ya şəxsi məlumat tələb olunmur. Sualınız cavab hazırlamaq üçün süni intellekt xidmətinə (Google Gemini) göndərilir; DataDanış onu saxlamır. Şəxsi məlumat yazmayın.",
    credit: "Məlumatlar: Azərbaycan Respublikasının Dövlət Statistika Komitəsi, opendata.az (CC0).",
    builtBy: "Müəllif: Samur Eyyubov",
    disclaimer: "Cavablar yalnız göstərilən rəsmi cədvələ əsaslanır. Vacib qərarlar üçün mənbəni yoxlayın.",
    switchLang: "English",
    tooLong: "Sual çox uzundur. Zəhmət olmasa 300 simvoldan qısa yazın.",
    empty: "Zəhmət olmasa sual yazın.",
  },
  en: {
    tagline: "Ask a plain-language question about Azerbaijan's open government statistics — get an answer, a chart and the source.",
    how1: "Type your question (in Azerbaijani or English).",
    how2: "AI picks the matching official table; code calculates the numbers.",
    how3: "You get a short answer, a chart and the opendata.az source link.",
    examples: "Example questions",
    placeholder: "For example: How has inflation changed over the last 10 years?",
    ask: "Ask",
    thinking: "Preparing the answer…",
    source: "Source",
    dataAsOf: "Data downloaded",
    showTable: "Show table",
    year: "Year",
    datasetsTitle: "Data available now",
    privacyTitle: "Privacy",
    privacy:
      "No account or personal data is needed. Your question is sent to an AI service (Google Gemini) to prepare the answer; DataDanış does not store it. Please don't type personal information.",
    credit: "Data: State Statistics Committee of the Republic of Azerbaijan, via opendata.az (CC0).",
    builtBy: "Made by Samur Eyyubov",
    disclaimer: "Answers are based only on the official table shown. Check the source before important decisions.",
    switchLang: "Azərbaycanca",
    tooLong: "That question is too long. Please keep it under 300 characters.",
    empty: "Please type a question.",
  },
} as const;

export type ErrorCode =
  | Failure["reason"]
  | "busy"
  | "daily_limit"
  | "visitor_limit"
  | "ai_unavailable"
  | "bad_request";

export function errorMessage(code: ErrorCode, lang: Lang, detail?: Failure["detail"]): string {
  const range = detail?.year_min && detail?.year_max ? `${detail.year_min}–${detail.year_max}` : "";
  const ds = detail?.dataset_title ?? "";
  const az: Record<ErrorCode, string> = {
    cannot_answer:
      "Bu suala cavab verəcək məlumat DataDanış-da hələ yoxdur. Aşağıdakı mövzulardan birini soruşun: qiymətlər, əhali, maaşlar, gəlirlər, işsizlik, məzənnə, ÜDM, ömür uzunluğu, doğum və ölüm, nikah və boşanma, turizm, cinayət.",
    unknown_dataset: "Uyğun cədvəl tapılmadı. Sualı başqa sözlərlə yazmağa çalışın.",
    unknown_item: `"${ds}" cədvəlində bu göstərici yoxdur. Sualı bir az fərqli yazmağa çalışın.`,
    year_not_covered: `"${ds}" cədvəlində yalnız ${range} illəri üzrə məlumat var.`,
    no_data: `"${ds}" cədvəlində bu dövr üçün məlumat yoxdur.`,
    busy: "Hazırda çox sual gəlir. Bir neçə saniyədən sonra yenidən cəhd edin.",
    daily_limit: "Bugünkü sual limiti doldu. Nümunə suallar işləməyə davam edir; sabah yenidən cəhd edin.",
    visitor_limit: "Qısa müddətdə çox sual verdiniz. Bir az sonra yenidən cəhd edin.",
    ai_unavailable: "Süni intellekt xidməti hazırda cavab vermir. Nümunə suallar işləməyə davam edir; bir az sonra yenidən cəhd edin.",
    bad_request: "Sorğu düzgün deyil. Səhifəni yeniləyib yenidən cəhd edin.",
  };
  const en: Record<ErrorCode, string> = {
    cannot_answer:
      "DataDanış doesn't have data that answers this yet. Try one of these topics: prices, population, wages, income, unemployment, exchange rates, GDP, life expectancy, births and deaths, marriages and divorces, tourism, crime.",
    unknown_dataset: "No matching table was found. Try asking in different words.",
    unknown_item: `The "${ds}" table doesn't have that figure. Try asking a little differently.`,
    year_not_covered: `The "${ds}" table only covers ${range}.`,
    no_data: `The "${ds}" table has no data for that period.`,
    busy: "Lots of questions right now. Please try again in a few seconds.",
    daily_limit: "Today's question limit has been reached. The example questions still work; please try again tomorrow.",
    visitor_limit: "You've asked a lot of questions in a short time. Please try again a little later.",
    ai_unavailable: "The AI service isn't responding right now. The example questions still work; please try again shortly.",
    bad_request: "Something was wrong with the request. Refresh the page and try again.",
  };
  return (lang === "az" ? az : en)[code];
}
