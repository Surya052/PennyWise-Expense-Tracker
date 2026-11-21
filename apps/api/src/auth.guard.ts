import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { sha256 } from './common/password';
import { moduleForPath, userModules } from './common/modules';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const raw = req.cookies?.pw_session;
    if (!raw || typeof raw !== 'string') throw new UnauthorizedException({ message: 'Sign in required' });
    const session = await this.prisma.session.findUnique({ where: { id: sha256(raw) }, include: { user: true } });
    if (!session || session.expiresAt.getTime() < Date.now() || !session.user.isActive) {
      throw new UnauthorizedException({ message: 'Sign in required' });
    }
    req.user = session.user;
    const path = String(req.originalUrl || req.url || '');
    const allowed = /\/api\/auth\/(logout|change-password|me)(\?|$)/.test(path);
    if (session.user.mustChangePassword && !allowed) {
      throw new ForbiddenException({ message: 'Password change required', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    const required = moduleForPath(path);
    if (required && !userModules(session.user).includes(required)) {
      throw new ForbiddenException({ message: 'That module is turned off for this account' });
    }
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.user?.role !== 'admin') throw new ForbiddenException({ message: 'Admin only' });
    return true;
  }
}
