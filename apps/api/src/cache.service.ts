import { Injectable } from '@nestjs/common';

type Entry = { at: number; data: unknown };

@Injectable()
export class CacheService {
  private store = new Map<string, Entry>();

  get<T>(key: string): T | null {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > 60_000) {
      this.store.delete(key);
      return null;
    }
    return hit.data as T;
  }

  set(key: string, data: unknown) {
    this.store.set(key, { at: Date.now(), data });
  }

  dropUser(userId: string) {
    for (const key of this.store.keys()) {
      if (key.startsWith(`${userId}|`)) this.store.delete(key);
    }
  }
}
