import { createRouter, createWebHistory } from 'vue-router';

import BootstrapView from './views/BootstrapView.vue';
import { useAuthStore } from './auth';
import LoginView from './views/LoginView.vue';

export const router = createRouter({
  history: createWebHistory('/admin/'),
  routes: [
    {
      path: '/',
      name: 'bootstrap',
      component: BootstrapView,
    },
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.initialize();
  if (!to.meta.public && !auth.authenticated) return { name: 'login' };
  if (!to.meta.public && !auth.isAdmin) return { name: 'login' };
  if (to.name === 'login' && auth.isAdmin) return { name: 'bootstrap' };
  return true;
});
