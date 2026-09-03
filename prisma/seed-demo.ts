import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo1234";

const USERS: { email: string; name: string; role: string; extra?: Record<string, unknown> }[] = [
  { email: "admin@demo.onsale", name: "Администратор (демо)", role: "ADMIN" },
  { email: "seller@demo.onsale", name: "Продавец (демо)", role: "SELLER" },
  { email: "agent@demo.onsale", name: "Торговый агент (демо)", role: "AGENT" },
  { email: "courier@demo.onsale", name: "Курьер (демо)", role: "COURIER" },
  { email: "analyst@demo.onsale", name: "Аналитик (демо)", role: "ANALYST" },
  {
    email: "buyer@demo.onsale",
    name: 'ООО "Покупатель" (демо)',
    role: "BUYER",
    extra: { address: "г. Демоград, ул. Примерная, 1", phone: "+7 900 000-00-00", deferral: 14 },
  },
];

async function main() {
  // Демо-пароль задаётся переменной окружения (по умолчанию demo1234)
  const password = process.env.DEMO_PASSWORD || DEMO_PASSWORD;
  const pwd = await bcrypt.hash(password, 10);

  const agent = await prisma.user.upsert({
    where: { email: "agent@demo.onsale" },
    update: { role: "AGENT" },
    create: { email: "agent@demo.onsale", name: "Торговый агент (демо)", passwordHash: pwd, role: "AGENT" },
  });

  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, ...(u.role === "BUYER" ? { agentId: agent.id } : {}) },
      create: {
        email: u.email,
        name: u.name,
        passwordHash: pwd,
        role: u.role,
        ...(u.role === "BUYER" ? { agentId: agent.id } : {}),
        ...(u.extra ?? {}),
      },
    });
  }

  // Стартовые причины корректировки
  for (const reason of ["Нет на складе", "Пересорт", "Ошибка клиента", "Замена по согласованию"]) {
    await prisma.orderEditReason.upsert({ where: { name: reason }, update: {}, create: { name: reason } });
  }

  // Минимальный демо-товар (одна позиция, чтобы каталог не был пуст; прайс можно загрузить поверх)
  const cat = await prisma.category.upsert({
    where: { name: "Демо-категория" },
    update: {},
    create: { name: "Демо-категория" },
  });
  await prisma.product.upsert({
    where: { article: "DEMO-001" },
    update: {},
    create: {
      article: "DEMO-001",
      name: "Демо-товар (замените своим прайс-листом)",
      unit: "шт",
      price: 100,
      stock: 1000,
      manufacturer: "Демо-производитель",
      categoryId: cat.id,
    },
  });

  console.log("=== ДЕМО-СИСТЕМА ГОТОВА ===");
  console.log("Пароль для всех демо-пользователей:", password);
  for (const u of USERS) console.log("  ", u.email, "-", u.role);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });