import { describe, it, expect } from "vitest";
import { parseUserAgent } from "@/lib/ua";

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const EDGE_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0";
const YANDEX =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 YaBrowser/24.4.0.0 Safari/537.36";
const FIREFOX =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const OPERA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0";

describe("parseUserAgent — браузеры", () => {
  it("Chrome на Windows", () => {
    const r = parseUserAgent(CHROME_WIN);
    expect(r.browser).toBe("Chrome");
    expect(r.browserVersion).toBe("125.0.0.0");
  });

  it("Edge не путается с Chrome (строка Chrome тоже есть)", () => {
    const r = parseUserAgent(EDGE_WIN);
    expect(r.browser).toBe("Edge");
  });

  it("Яндекс Браузер определяется раньше Chrome", () => {
    const r = parseUserAgent(YANDEX);
    expect(r.browser).toBe("Яндекс Браузер");
  });

  it("Opera определяется раньше Chrome", () => {
    const r = parseUserAgent(OPERA);
    expect(r.browser).toBe("Opera");
  });

  it("Firefox", () => {
    const r = parseUserAgent(FIREFOX);
    expect(r.browser).toBe("Firefox");
    expect(r.browserVersion).toBe("126.0");
  });

  it("Safari на Mac", () => {
    const r = parseUserAgent(SAFARI_MAC);
    expect(r.browser).toBe("Safari");
  });
});

describe("parseUserAgent — ОС и устройства", () => {
  it("Windows — desktop", () => {
    const r = parseUserAgent(CHROME_WIN);
    expect(r.os).toBe("Windows 10/11");
    expect(r.deviceType).toBe("desktop");
  });

  it("macOS Safari — desktop", () => {
    const r = parseUserAgent(SAFARI_MAC);
    expect(r.os).toBe("macOS");
    expect(r.deviceType).toBe("desktop");
  });

  it("iPhone — mobile + iOS", () => {
    const r = parseUserAgent(IPHONE);
    expect(r.os).toBe("iOS 17.4");
    expect(r.deviceType).toBe("mobile");
  });

  it("Android телефон — mobile", () => {
    const r = parseUserAgent(ANDROID_PHONE);
    expect(r.os).toBe("Android 14");
    expect(r.deviceType).toBe("mobile");
  });

  it("Android планшет — tablet", () => {
    const r = parseUserAgent(ANDROID_TABLET);
    expect(r.deviceType).toBe("tablet");
  });

  it("пустой UA — все поля null", () => {
    const r = parseUserAgent("");
    expect(r.browser).toBeNull();
    expect(r.os).toBeNull();
    expect(r.deviceType).toBeNull();
  });
});