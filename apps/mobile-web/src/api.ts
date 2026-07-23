interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  code?: string;
  message?: string;
  requestId?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId = '',
  ) {
    super(message);
  }
}

export class ApiNetworkError extends Error {
  readonly code = 'NETWORK_ERROR';
}

export interface ApiSession {
  accessToken: () => string | undefined;
  refresh: () => Promise<void>;
  expire: () => void | Promise<void>;
}

let refreshFlight: Promise<void> | undefined;

function isAuthPath(path: string): boolean {
  return (
    path === '/auth/refresh' ||
    path === '/auth/login' ||
    path === '/auth/register' ||
    path === '/auth/logout' ||
    path.startsWith('/auth/password/') ||
    path.startsWith('/auth/qq/')
  );
}

export function isRequestCancelled(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === 'AbortError';
}

function assertNotAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
}

export async function apiEnvelopeRequest<T>(
  path: string,
  accessToken: string | undefined,
  init: RequestInit = {},
): Promise<{ data: T; requestId: string }> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });
  } catch (cause) {
    if (isRequestCancelled(cause)) throw cause;
    throw new ApiNetworkError('网络连接失败，请检查网络后重试');
  }

  let body: ApiEnvelope<T>;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError('服务响应异常，请稍后重试', response.status, 'INVALID_RESPONSE');
  }
  if (!response.ok) {
    throw new ApiError(
      body.message || '请求失败，请稍后重试',
      response.status,
      body.code || '',
      body.requestId || '',
    );
  }
  return { data: body.data, requestId: body.requestId || '' };
}

export async function apiRequest<T>(
  path: string,
  accessToken: string | undefined,
  init: RequestInit = {},
): Promise<T> {
  return (await apiEnvelopeRequest<T>(path, accessToken, init)).data;
}

export async function sessionApiRequest<T>(
  path: string,
  session: ApiSession,
  init: RequestInit = {},
): Promise<T> {
  assertNotAborted(init.signal);
  try {
    return await apiRequest<T>(path, session.accessToken(), init);
  } catch (cause) {
    if (!(cause instanceof ApiError) || cause.status !== 401 || isAuthPath(path)) throw cause;
  }

  assertNotAborted(init.signal);
  refreshFlight ??= session.refresh().finally(() => {
    refreshFlight = undefined;
  });
  try {
    await refreshFlight;
  } catch (cause) {
    assertNotAborted(init.signal);
    await session.expire();
    throw cause;
  }
  assertNotAborted(init.signal);
  try {
    return await apiRequest<T>(path, session.accessToken(), init);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) await session.expire();
    throw cause;
  }
}

async function apiRawRequest(
  path: string,
  accessToken: string | undefined,
  init: RequestInit = {},
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });
  } catch (cause) {
    if (isRequestCancelled(cause)) throw cause;
    throw new ApiNetworkError('网络连接失败，请检查网络后重试');
  }
  if (response.ok) return response;
  let body: Partial<ApiEnvelope<unknown>> = {};
  try {
    body = (await response.json()) as Partial<ApiEnvelope<unknown>>;
  } catch {
    // A failed download may not have a JSON body; keep the stable fallback below.
  }
  throw new ApiError(
    body.message || '请求失败，请稍后重试',
    response.status,
    body.code || '',
    body.requestId || '',
  );
}

export async function sessionRawRequest(
  path: string,
  session: ApiSession,
  init: RequestInit = {},
): Promise<Response> {
  assertNotAborted(init.signal);
  try {
    return await apiRawRequest(path, session.accessToken(), init);
  } catch (cause) {
    if (!(cause instanceof ApiError) || cause.status !== 401 || isAuthPath(path)) throw cause;
  }
  assertNotAborted(init.signal);
  refreshFlight ??= session.refresh().finally(() => {
    refreshFlight = undefined;
  });
  try {
    await refreshFlight;
  } catch (cause) {
    assertNotAborted(init.signal);
    await session.expire();
    throw cause;
  }
  assertNotAborted(init.signal);
  try {
    return await apiRawRequest(path, session.accessToken(), init);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) await session.expire();
    throw cause;
  }
}
