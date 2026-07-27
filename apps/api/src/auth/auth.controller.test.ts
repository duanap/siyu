import type { Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RequestWithId } from '../request-id';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { OAuthService } from './oauth.service';
import type { AuthRateLimitService } from './rate-limit.service';

function createController() {
  const auth = {
    register: vi.fn(),
    requestReset: vi.fn(),
    resetPassword: vi.fn(),
  };
  const oauth = { createState: vi.fn(), consumeCallback: vi.fn() };
  const rateLimit = { consume: vi.fn() };
  const controller = new AuthController(
    auth as unknown as AuthService,
    oauth as unknown as OAuthService,
    rateLimit as unknown as AuthRateLimitService,
  );
  return { controller, auth, oauth, rateLimit };
}

const request = { requestId: 'req_capabilities', ip: '127.0.0.1' } as RequestWithId;

describe('authentication deployment capabilities (BR-AUTH-007, BR-AUTH-008)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('publishes the same disabled capabilities enforced by the controller', async () => {
    vi.stubEnv('SIYU_REGISTRATION_ENABLED', 'false');
    vi.stubEnv('SIYU_QQ_AUTH_ENABLED', 'false');
    vi.stubEnv('SIYU_PASSWORD_RESET_ENABLED', 'false');
    const { controller, auth, oauth, rateLimit } = createController();

    await expect(controller.capabilities(request)).resolves.toMatchObject({
      data: {
        emailPassword: true,
        registration: false,
        qqOAuth: false,
        passwordReset: false,
      },
    });
    await expect(
      controller.register(
        { email: 'user@example.com', password: 'safe-password-1234', nickname: '用户' },
        request,
        {} as Response,
      ),
    ).rejects.toMatchObject({ status: 503 });
    await expect(controller.forgot({ email: 'user@example.com' }, request)).rejects.toMatchObject({
      status: 503,
    });
    await expect(controller.qqAuthorize(request, {} as Response)).rejects.toMatchObject({
      status: 503,
    });

    expect(auth.register).not.toHaveBeenCalled();
    expect(auth.requestReset).not.toHaveBeenCalled();
    expect(oauth.createState).not.toHaveBeenCalled();
    expect(rateLimit.consume).toHaveBeenCalledTimes(1);
  });
});
