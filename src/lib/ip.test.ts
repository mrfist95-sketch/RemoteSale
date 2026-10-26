import { describe, it, expect } from "vitest";
import { isPrivateIp, pickClientIp, forwardedChain } from "@/lib/ip";

describe("isPrivateIp", () => {
  it("локальные и приватные", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.1.2.3")).toBe(true);
    expect(isPrivateIp("192.168.1.50")).toBe(true);
    expect(isPrivateIp("172.20.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("169.254.1.1")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("fd12::1")).toBe(true);
    expect(isPrivateIp("::ffff:192.168.0.1")).toBe(true);
    expect(isPrivateIp("unknown")).toBe(true);
  });

  it("публичные", () => {
    expect(isPrivateIp("95.181.47.206")).toBe(false);
    expect(isPrivateIp("2.27.28.165")).toBe(false);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("172.32.0.1")).toBe(false);
    expect(isPrivateIp("2001:db8::1")).toBe(false);
  });
});

describe("pickClientIp", () => {
  it("XFF без приватных — последний элемент (добавлен нашим nginx)", () => {
    expect(pickClientIp({ "x-forwarded-for": "203.0.113.5, 95.181.47.206" })).toBe(
      "95.181.47.206",
    );
  });

  it("клиент за NAT прислал внутренний адрес — берём публичный из конца цепочки", () => {
    expect(pickClientIp({ "x-forwarded-for": "192.168.1.50, 95.181.47.206" })).toBe(
      "95.181.47.206",
    );
  });

  it("спуфер прислал поддельный публичный первым — игнорируем, берём последний", () => {
    expect(pickClientIp({ "x-forwarded-for": "8.8.8.8, 95.181.47.206" })).toBe("95.181.47.206");
  });

  it("одиночный адрес в XFF", () => {
    expect(pickClientIp({ "x-forwarded-for": "95.181.47.206" })).toBe("95.181.47.206");
  });

  it("только приватные в XFF — берём первый (внутренний адрес)", () => {
    expect(pickClientIp({ "x-forwarded-for": "192.168.1.50" })).toBe("192.168.1.50");
  });

  it("без XFF — x-real-ip", () => {
    expect(pickClientIp({ "x-real-ip": "95.181.47.206" })).toBe("95.181.47.206");
  });

  it("ничего — unknown", () => {
    expect(pickClientIp({})).toBe("unknown");
    expect(pickClientIp(undefined)).toBe("unknown");
  });
});

describe("forwardedChain", () => {
  it("полная цепочка с нормализацией", () => {
    expect(
      forwardedChain({ "x-forwarded-for": "192.168.1.50 ,  95.181.47.206" }),
    ).toBe("192.168.1.50, 95.181.47.206");
  });

  it("пустая цепочка — null", () => {
    expect(forwardedChain({})).toBeNull();
    expect(forwardedChain({ "x-forwarded-for": "" })).toBeNull();
    expect(forwardedChain({ "x-forwarded-for": "," })).toBeNull();
  });
});