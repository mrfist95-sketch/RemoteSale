// Лёгкий парсер User-Agent без внешних зависимостей:
// браузер, версия, ОС и тип устройства из строки UA

export interface ParsedUA {
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  deviceType: "desktop" | "mobile" | "tablet" | null;
}

const BROWSER_RULES: { re: RegExp; name: string }[] = [
  { re: /YaBrowser\/([\d.]+)/, name: "Яндекс Браузер" },
  { re: /Edg(?:e|A|iOS)?\/([\d.]+)/, name: "Edge" },
  { re: /OPR\/([\d.]+)/, name: "Opera" },
  { re: /SamsungBrowser\/([\d.]+)/, name: "Samsung Internet" },
  { re: /FxiOS\/([\d.]+)/, name: "Firefox iOS" },
  { re: /CriOS\/([\d.]+)/, name: "Chrome iOS" },
  { re: /Firefox\/([\d.]+)/, name: "Firefox" },
  { re: /Chrome\/([\d.]+)/, name: "Chrome" },
  { re: /Version\/([\d.]+)[^)]*Safari\//, name: "Safari" },
  { re: /MSIE ([\d.]+)/, name: "Internet Explorer" },
  { re: /Trident\/[\d.]+.*rv:([\d.]+)/, name: "Internet Explorer" },
];

function parseBrowser(ua: string): { browser: string | null; version: string | null } {
  // Порядок важен: Edge/OPR/YaBrowser содержат строку Chrome, Safari — в почти всех
  for (const { re, name } of BROWSER_RULES) {
    const m = ua.match(re);
    if (m) return { browser: name, version: m[1] ?? null };
  }
  return { browser: null, version: null };
}

function parseOs(ua: string): string | null {
  if (/Windows NT 10\.0/.test(ua)) return "Windows 10/11";
  if (/Windows NT 6\.3/.test(ua)) return "Windows 8.1";
  if (/Windows NT 6\.1/.test(ua)) return "Windows 7";
  if (/Windows/.test(ua)) return "Windows";
  const android = ua.match(/Android ([\d.]+)/);
  if (android) return `Android ${android[1]}`;
  const ios = ua.match(/(?:iPhone|iPad|iPod).*?OS (\d+_\d+)/);
  if (ios) return `iOS ${ios[1].replace("_", ".")}`;
  if (/(iPhone|iPad|iPod)/.test(ua)) return "iOS";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

function parseDeviceType(ua: string): "desktop" | "mobile" | "tablet" | null {
  if (/iPad|Tablet(?! PC)|PlayBook|Silk\//.test(ua)) return "tablet";
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return "tablet";
  if (/Mobi|iPhone|Windows Phone|IEMobile/.test(ua)) return "mobile";
  if (/Windows|Macintosh|Linux|x86_64/.test(ua)) return "desktop";
  return null;
}

export function parseUserAgent(uaRaw: string | null | undefined): ParsedUA {
  const ua = uaRaw ?? "";
  if (!ua.trim()) return { browser: null, browserVersion: null, os: null, deviceType: null };
  const { browser, version } = parseBrowser(ua);
  return {
    browser,
    browserVersion: version,
    os: parseOs(ua),
    deviceType: parseDeviceType(ua),
  };
}