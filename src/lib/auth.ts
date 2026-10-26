import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseUserAgent } from "@/lib/ua";
import { pickClientIp, forwardedChain, headerStr } from "@/lib/ip";
import {
  checkRateLimit,
  registerFailure,
  registerSuccess,
  IP_MAX_ATTEMPTS,
} from "@/lib/rate-limit";

// Хэш-заглушка: сравниваем с ней, когда пользователя нет, чтобы время ответа
// не выдавало, зарегистрирован ли email.
let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("not-a-real-password", 10));

/** Найти пользователя по email без учёта регистра (email храним в нижнем регистре) */
export async function findUserByEmail(raw: string) {
  const email = raw.trim().toLowerCase();
  return (
    (await prisma.user.findUnique({ where: { email } })) ??
    (raw.trim() !== email ? await prisma.user.findUnique({ where: { email: raw.trim() } }) : null)
  );
}

/**
 * Записать событие входа с телеметрией устройства.
 * Телеметрия не должна ломать сам вход — любые ошибки глушим.
 */
async function logLoginEvent(input: {
  headers: Record<string, unknown> | undefined;
  email: string;
  userId: string | null;
  success: boolean;
  reason?: string;
  credentials: Record<string, unknown> | undefined;
}) {
  try {
    const ua = headerStr(input.headers, "user-agent");
    const parsed = parseUserAgent(ua);
    const c = input.credentials ?? {};
    const str = (v: unknown): string | null =>
      typeof v === "string" && v.trim() ? v.trim() : null;
    const bool = (v: unknown): boolean | null =>
      typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : null;
    await prisma.loginEvent.create({
      data: {
        userId: input.userId,
        email: input.email.toLowerCase(),
        success: input.success,
        reason: input.reason ?? null,
        ip: pickClientIp(input.headers),
        forwardedFor: forwardedChain(input.headers),
        userAgent: ua,
        browser: parsed.browser,
        browserVersion: parsed.browserVersion,
        os: parsed.os,
        deviceType: parsed.deviceType,
        language: headerStr(input.headers, "accept-language"),
        referrer: headerStr(input.headers, "referer"),
        screen: str(c.screen),
        viewport: str(c.viewport),
        timezone: str(c.timezone),
        platform: str(c.platform),
        hardware: str(c.hardware),
        touch: bool(c.touch),
        cookiesEnabled: bool(c.cookies),
      },
    });
  } catch {
    // журнал не должен мешать входу
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // Скрытые поля клиентской телеметрии (заполняет LoginForm)
        screen: { label: "screen", type: "text" },
        viewport: { label: "viewport", type: "text" },
        timezone: { label: "timezone", type: "text" },
        platform: { label: "platform", type: "text" },
        hardware: { label: "hardware", type: "text" },
        touch: { label: "touch", type: "text" },
        cookies: { label: "cookies", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        const headers = req?.headers as Record<string, unknown> | undefined;
        const key = credentials.email.toLowerCase().trim();
        const ipKey = `ip:${pickClientIp(headers)}`;

        const logFail = async (reason: string, userId: string | null = null) => {
          await logLoginEvent({
            headers,
            email: key,
            userId,
            success: false,
            reason,
            credentials: credentials as Record<string, unknown>,
          });
        };

        for (const [k, max] of [[key, undefined], [ipKey, IP_MAX_ATTEMPTS]] as const) {
          const rl = checkRateLimit(k, max);
          if (rl.blocked) {
            const sec = Math.ceil(rl.retryAfterMs / 1000);
            await logFail("лимит попыток (вход заблокирован)");
            throw new Error(`Слишком много попыток входа. Повторите через ${sec} с.`);
          }
        }

        const user = await findUserByEmail(credentials.email);
        const ok = await bcrypt.compare(credentials.password, user?.passwordHash ?? getDummyHash());
        if (!user || !ok) {
          registerFailure(key);
          registerFailure(ipKey, IP_MAX_ATTEMPTS);
          await logFail("неверный email или пароль", user?.id ?? null);
          return null;
        }
        if (user.blocked) {
          await logFail("учётная запись заблокирована", user.id);
          throw new Error("Учётная запись заблокирована. Обратитесь к администратору.");
        }
        registerSuccess(key);
        registerSuccess(ipKey);
        await logLoginEvent({
          headers,
          email: key,
          userId: user.id,
          success: true,
          credentials: credentials as Record<string, unknown>,
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sv: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    // Вызывается при каждом чтении сессии: роль и статус берём из БД,
    // поэтому смена роли, блокировка или смена пароля действуют сразу.
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.sv = (user as { sv?: number }).sv ?? 0;
        return token;
      }
      if (!token.sub || token.revoked) return token;
      const db = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { role: true, blocked: true, sessionVersion: true, name: true },
      });
      if (!db || db.blocked || db.sessionVersion !== (token.sv ?? 0)) {
        token.revoked = true;
        return token;
      }
      token.role = db.role;
      token.name = db.name;
      return token;
    },
    async session({ session, token }) {
      if (token.revoked || !token.sub) {
        return { ...session, user: undefined } as unknown as typeof session;
      }
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = (token.role as string) ?? "BUYER";
      }
      return session;
    },
  },
};
