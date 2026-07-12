import { createHash } from 'node:crypto';

import { HttpException, HttpStatus, Injectable, type OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';

import { readConfig } from '../config';

@Injectable()
export class AuthRateLimitService implements OnModuleDestroy {
  private redis: IORedis | undefined;

  async onModuleDestroy(): Promise<void> {
    if (this.redis && this.redis.status !== 'end') await this.redis.quit();
  }

  async consume(
    scope: string,
    subject: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    this.redis ??= new IORedis(readConfig().redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    if (this.redis.status === 'wait') await this.redis.connect();
    const subjectHash = createHash('sha256').update(subject).digest('hex').slice(0, 32);
    const key = `rate:auth:${scope}:${subjectHash}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, windowSeconds);
    if (count > limit)
      throw new HttpException('请求过于频繁，请稍后重试', HttpStatus.TOO_MANY_REQUESTS);
  }
}
