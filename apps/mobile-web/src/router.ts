import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from './auth';
import AccountView from './views/AccountView.vue';
import AuthenticationView from './views/AuthenticationView.vue';
import CategoryManagementView from './views/CategoryManagementView.vue';
import CoupleLedgerView from './views/CoupleLedgerView.vue';
import EntriesView from './views/EntriesView.vue';
import EntryCreateView from './views/EntryCreateView.vue';
import EntryDetailView from './views/EntryDetailView.vue';
import ForbiddenView from './views/ForbiddenView.vue';
import HomeView from './views/HomeView.vue';
import LegalView from './views/LegalView.vue';
import OAuthCallbackView from './views/OAuthCallbackView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { public: true } },
    {
      path: '/privacy',
      name: 'privacy',
      component: LegalView,
      meta: { public: true },
    },
    {
      path: '/terms',
      name: 'terms',
      component: LegalView,
      meta: { public: true },
    },
    {
      path: '/login',
      name: 'login',
      component: AuthenticationView,
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: AuthenticationView,
      meta: { public: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot',
      component: AuthenticationView,
      meta: { public: true },
    },
    {
      path: '/reset-password',
      name: 'reset',
      component: AuthenticationView,
      meta: { public: true },
    },
    {
      path: '/oauth/callback',
      name: 'oauth-callback',
      component: OAuthCallbackView,
      meta: { public: true },
    },
    { path: '/forbidden', name: 'forbidden', component: ForbiddenView },
    { path: '/home', name: 'dashboard', component: () => import('./views/DashboardView.vue') },
    { path: '/account', name: 'account', component: AccountView },
    { path: '/categories', name: 'categories', component: CategoryManagementView },
    { path: '/couple/invite', name: 'couple-invite', component: CoupleLedgerView },
    { path: '/entries', name: 'entries', component: EntriesView },
    { path: '/entries/new', name: 'entry-new', component: EntryCreateView },
    { path: '/entries/:id', name: 'entry-detail', component: EntryDetailView },
    { path: '/debts', name: 'debts', component: () => import('./views/DebtsView.vue') },
    { path: '/debts/new', name: 'debt-new', component: () => import('./views/DebtCreateView.vue') },
    {
      path: '/debts/:id',
      name: 'debt-detail',
      component: () => import('./views/DebtDetailView.vue'),
    },
    {
      path: '/statistics',
      name: 'statistics',
      component: () => import('./views/StatisticsView.vue'),
    },
    {
      path: '/recurring',
      name: 'recurring',
      component: () => import('./views/RecurringListView.vue'),
    },
    {
      path: '/recurring/new',
      name: 'recurring-new',
      component: () => import('./views/RecurringCreateView.vue'),
    },
    {
      path: '/recurring/:id',
      name: 'recurring-detail',
      component: () => import('./views/RecurringDetailView.vue'),
    },
    {
      path: '/salary',
      name: 'salary',
      component: () => import('./views/SalaryHomeView.vue'),
    },
    {
      path: '/salary/year/:year',
      name: 'salary-year',
      component: () => import('./views/SalaryYearView.vue'),
    },
    {
      path: '/salary/:year/:month',
      name: 'salary-month',
      component: () => import('./views/SalaryMonthView.vue'),
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.initialize();
  if (!to.meta.public && !auth.authenticated)
    return { name: 'login', query: { redirect: to.fullPath } };
  if (to.meta.public && auth.authenticated && ['login', 'register'].includes(String(to.name)))
    return { name: 'account' };
  return true;
});
