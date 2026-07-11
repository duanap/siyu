import { createRouter, createWebHistory } from 'vue-router';

import BootstrapView from './views/BootstrapView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'bootstrap',
      component: BootstrapView,
    },
  ],
});
