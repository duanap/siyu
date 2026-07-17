import { useRoute, useRouter } from 'vue-router';

import type { ApiSession } from './api';
import { useAuthStore } from './auth';

export function useApiSession(): ApiSession {
  const auth = useAuthStore();
  const route = useRoute();
  const router = useRouter();
  return {
    accessToken: () => auth.accessToken,
    refresh: () => auth.refresh(),
    expire: async () => {
      auth.clear();
      await router.replace({ name: 'login', query: { redirect: route.fullPath } });
    },
  };
}
