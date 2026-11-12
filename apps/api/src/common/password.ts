import { createHash, randomBytes } from 'crypto';
import { HttpException } from '@nestjs/common';
import { fail } from './money';

export function assertPassword(pw: unknown): string {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 72) {
    fail('Password must be 8 to 72 characters');
  }
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) {
    fail('Password needs a lowercase letter, an uppercase letter, and a digit');
  }
  return pw;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    throw new HttpException({ message: 'Too many attempts. Try again later.' }, 429);
  }
  recent.push(now);
  buckets.set(key, recent);
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}
