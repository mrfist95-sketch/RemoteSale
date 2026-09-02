import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // tsx не читает .env сам — подгружаем, если переменные не заданы
  if (!process.env.ADMIN_PASSWORD) {
    try {
      await import("dotenv/config");
    } catch {
      // dotenv недоступен — используем переменные окружения как есть
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || adminPassword.length < 8) {
    throw new Error(
      "ADMIN_PASSWORD не задан или короче 8 символов. Задайте переменные окружения ADMIN_EMAIL и ADMIN_PASSWORD."
    );
  }

  const pwd = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: { email: adminEmail, name: "Администратор", passwordHash: pwd, role: "ADMIN" },
  });

  console.log("Seed finished.");
  console.log("Администратор создан:", adminEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });