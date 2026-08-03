<script setup lang="ts">
import { antTheme } from '@siyu/ui-tokens';
import { ConfigProvider } from 'ant-design-vue';
import { onBeforeUnmount } from 'vue';
import { RouterView } from 'vue-router';

import { applyTheme, readThemePreference, resolveThemePreference } from './theme';

const systemTheme =
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : undefined;

function syncTheme(): void {
  applyTheme(resolveThemePreference(readThemePreference(), systemTheme?.matches ?? false));
}

syncTheme();
systemTheme?.addEventListener?.('change', syncTheme);
onBeforeUnmount(() => systemTheme?.removeEventListener?.('change', syncTheme));
</script>

<template>
  <ConfigProvider :theme="antTheme">
    <RouterView />
  </ConfigProvider>
</template>
