<script setup lang="ts">
import { antTheme } from '@siyu/ui-tokens';
import { ConfigProvider } from 'ant-design-vue';
import { RouterView } from 'vue-router';

const storedTheme = localStorage.getItem('siyu-theme');
document.documentElement.dataset.theme =
  storedTheme === 'light' || storedTheme === 'dark'
    ? storedTheme
    : window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
</script>

<template>
  <ConfigProvider :theme="antTheme">
    <RouterView />
  </ConfigProvider>
</template>
