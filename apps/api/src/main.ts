import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: false });
  const expressApp = app.getHttpAdapter().getInstance();
  if (process.env.TRUST_PROXY === 'true') expressApp.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  expressApp.disable('x-powered-by');
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  const origin = process.env.WEB_ORIGIN;
  if (origin) {
    app.enableCors({ origin, credentials: true });
  }
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'production') return next();
    const host = String(req.headers.host || '');
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return next();
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
    const url = `https://${host}${req.url}`;
    return res.redirect(301, url);
  });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
}

bootstrap();
