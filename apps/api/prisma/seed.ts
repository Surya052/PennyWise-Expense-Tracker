import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { assertPassword } from '../src/common/password';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  { name: 'Food', type: 'expense', icon: 'utensils', color: '#D4846F' },
  { name: 'Rent', type: 'expense', icon: 'home', color: '#8F7CC0' },
  { name: 'Transport', type: 'expense', icon: 'car', color: '#5B8DB8' },
  { name: 'Bills', type: 'expense', icon: 'bolt', color: '#C9A227' },
  { name: 'Shopping', type: 'expense', icon: 'bag', color: '#9B8AA0' },
  { name: 'Health', type: 'expense', icon: 'heart', color: '#6BA58A' },
  { name: 'Education', type: 'expense', icon: 'book', color: '#6B8FD4' },
  { name: 'Entertainment', type: 'expense', icon: 'spark', color: '#D4A574' },
  { name: 'Other', type: 'expense', icon: 'more', color: '#8A8478' },
  { name: 'Salary', type: 'income', icon: 'briefcase', color: '#6BA58A' },
  { name: 'Freelance', type: 'income', icon: 'laptop', color: '#5B8DB8' },
  { name: 'Interest', type: 'income', icon: 'percent', color: '#8F7CC0' },
  { name: 'Gifts', type: 'income', icon: 'gift', color: '#D4846F' },
  { name: 'Other', type: 'income', icon: 'more', color: '#8A8478' },
] as const;

async function seedCategories(userId: string) {
  const count = await prisma.category.count({ where: { userId } });
  if (count > 0) return;
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((c, i) => ({
      userId,
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
      sortOrder: i,
    })),
  });
}

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const passwordRaw = process.env.ADMIN_PASSWORD;
  if (!name || !email || !passwordRaw) {
    console.log('Skip admin seed: set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in .env');
  } else {
    const password = assertPassword(passwordRaw);
    let admin = await prisma.user.findUnique({ where: { email } });
    if (!admin) {
      const passwordHash = await bcrypt.hash(password, 12);
      admin = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: 'admin',
          mustChangePassword: false,
        },
      });
      console.log(`Seeded admin: ${email}`);
    }
    await seedCategories(admin.id);
  }

  const demoEmail = process.env.DEMO_EMAIL?.trim().toLowerCase();
  const demoPassword = process.env.DEMO_PASSWORD;
  if (demoEmail && demoPassword) {
    let demo = await prisma.user.findUnique({ where: { email: demoEmail } });
    if (!demo) {
      const password = assertPassword(demoPassword);
      demo = await prisma.user.create({
        data: {
          name: 'Demo User',
          email: demoEmail,
          passwordHash: await bcrypt.hash(password, 12),
          role: 'user',
          mustChangePassword: false,
        },
      });
      console.log(`Seeded demo user: ${demoEmail}`);
    }
    await seedCategories(demo.id);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
