import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
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

function clientIp(headers: Record<string, unknown> | undefined): string {
  const h = headers ?? {};
  const real = h["x-real-ip"];
  if (typeof real === "string" && real) return real.trim();
  const fwd = h["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

/** Найти пользователя по email без учёта регистра (email храним в нижнем регистре) */
export async function findUserByEmail(raw: string) {
  const email = raw.trim().toLowerCase();
  return (
    (await prisma.user.findUnique({ where: { email } })) ??
    (raw.trim() !== email ? await prisma.user.findUnique({ where: { email: raw.trim() } }) : null)
  );
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
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        const key = credentials.email.toLowerCase().trim();
        const ipKey = `ip:${clientIp(req?.headers as Record<string, unknown>)}`;

        for (const [k, max] of [[key, undefined], [ipKey, IP_MAX_ATTEMPTS]] as const) {
          const rl = checkRateLimit(k, max);
          if (rl.blocked) {
            const sec = Math.ceil(rl.retryAfterMs / 1000);
            throw new Error(`Слишком много попыток входа. Повторите через ${sec} с.`);
          }
        }

        const user = await findUserByEmail(credentials.email);
        const ok = await bcrypt.compare(credentials.password, user?.passwordHash ?? getDummyHash());
        if (!user || !ok) {
          registerFailure(key);
          registerFailure(ipKey, IP_MAX_ATTEMPTS);
          return null;
        }
        if (user.blocked) {
          throw new Error("Учётная запись заблокирована. Обратитесь к администратору.");
        }
        registerSuccess(key);
        registerSuccess(ipKey);
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
