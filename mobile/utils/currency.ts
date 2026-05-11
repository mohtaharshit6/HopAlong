const LOCALE_TO_CURRENCY: Record<string, string> = {
  "en-IN": "INR", "hi": "INR", "hi-IN": "INR", "bn": "INR", "bn-IN": "INR",
  "en-US": "USD",
  "en-GB": "GBP",
  "en-AU": "AUD",
  "en-CA": "CAD",
  "en-NZ": "NZD",
  "de": "EUR", "de-DE": "EUR", "fr": "EUR", "fr-FR": "EUR",
  "es": "EUR", "it": "EUR", "nl": "EUR", "pt": "EUR",
  "ja": "JPY", "ja-JP": "JPY",
  "zh": "CNY", "zh-CN": "CNY",
  "ko": "KRW", "ko-KR": "KRW",
  "ar": "AED", "ar-AE": "AED", "ar-SA": "SAR",
  "ru": "RUB", "ru-RU": "RUB",
  "tr": "TRY", "tr-TR": "TRY",
  "id": "IDR", "id-ID": "IDR",
  "th": "THB", "th-TH": "THB",
  "ms": "MYR", "ms-MY": "MYR",
};

function detectCurrency(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return (
      LOCALE_TO_CURRENCY[locale] ||
      LOCALE_TO_CURRENCY[locale.split("-")[0]] ||
      "INR"
    );
  } catch {
    return "INR";
  }
}

// Cache so we don't re-detect on every call
const CURRENCY = detectCurrency();

export function getCurrencyCode(): string {
  return CURRENCY;
}

export function formatPrice(amount: number): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: CURRENCY,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${Math.round(amount)}`;
  }
}

export function getCurrencySymbol(): string {
  try {
    // Extract symbol by formatting 0 and stripping digits/spaces
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: CURRENCY,
      maximumFractionDigits: 0,
    })
      .format(0)
      .replace(/[\d,.\s]/g, "")
      .trim();
  } catch {
    return "₹";
  }
}
