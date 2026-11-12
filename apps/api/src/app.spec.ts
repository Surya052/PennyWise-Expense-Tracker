import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';
import * as bcrypt from 'bcrypt';

jest.setTimeout(120000);

describe('PennyWise API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const dbPath = resolve(__dirname, '..', 'prisma', 'jest.db');

  beforeAll(async () => {
    try {
      if (existsSync(dbPath)) rmSync(dbPath);
    } catch {
      //
    }
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.ADMIN_EMAIL = 'admin@test.local';
    process.env.ADMIN_PASSWORD = 'Adminpass1';
    process.env.ADMIN_NAME = 'Test Admin';
    execSync('npx prisma migrate deploy', { cwd: resolve(__dirname, '..'), env: process.env, stdio: 'ignore' });
    execSync('npx tsx prisma/seed.ts', { cwd: resolve(__dirname, '..'), env: process.env, stdio: 'ignore' });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
  });

  it('logs in admin and isolates account data between users', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: 'Adminpass1' });
    expect(login.status).toBeLessThan(300);
    const cookie = login.headers['set-cookie'];
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie);
    expect(me.body.user.email).toBe('admin@test.local');

    const user = await prisma.user.create({
      data: {
        name: 'Other',
        email: 'other@test.local',
        passwordHash: await bcrypt.hash('Otherpass1', 12),
        role: 'user',
      },
    });

    const account = await prisma.account.create({
      data: { userId: user.id, name: 'Secret', type: 'cash', openingBalance: 0n },
    });

    const otherLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'other@test.local', password: 'Otherpass1' });
    const otherCookie = otherLogin.headers['set-cookie'];

    const blocked = await request(app.getHttpServer()).get('/api/accounts').set('Cookie', cookie);
    const names = blocked.body.map((row: { name: string }) => row.name);
    expect(names).not.toContain('Secret');

    const allowed = await request(app.getHttpServer()).get('/api/accounts').set('Cookie', otherCookie);
    expect(allowed.body.some((row: { id: string }) => row.id === account.id)).toBe(true);
  });
});
