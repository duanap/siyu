<script setup lang="ts">
import { antTheme } from '@siyu/ui-tokens';
import { ConfigProvider } from 'ant-design-vue';
import { RouterView } from 'vue-router';

import { applyTheme } from './theme';

const storedTheme = localStorage.getItem('siyu-theme');
applyTheme(
  storedTheme === 'light' || storedTheme === 'dark'
    ? storedTheme
    : window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
);
</script>

<template>
  <ConfigProvider :theme="antTheme">
    <RouterView />
  </ConfigProvider>
</template>
