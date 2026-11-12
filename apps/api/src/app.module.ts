import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { existsSync } from 'fs';
import { PrismaService } from './prisma.service';
import { CacheService } from './cache.service';
import { AuthService } from './auth.service';
import { AdminService } from './admin.service';
import { BooksService } from './books.service';
import { ReportService } from './report.service';
import { PlanService } from './plan.service';
import { AuthGuard, AdminGuard } from './auth.guard';
import { ApiController } from './api.controller';

const webDist = join(__dirname, '..', '..', 'web', 'dist');
const staticModules = existsSync(webDist)
  ? [
      ServeStaticModule.forRoot({
        rootPath: webDist,
        exclude: ['/api/(.*)'],
      }),
    ]
  : [];

@Module({
  imports: [ScheduleModule.forRoot(), ...staticModules],
  controllers: [ApiController],
  providers: [
    PrismaService,
    CacheService,
    AuthService,
    AdminService,
    BooksService,
    ReportService,
    PlanService,
    AuthGuard,
    AdminGuard,
  ],
})
export class AppModule {}
