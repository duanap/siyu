<script setup lang="ts">
import { antTheme } from '@siyu/ui-tokens';
import { ConfigProvider } from 'ant-design-vue';
import { RouterView } from 'vue-router';
</script>

<template>
  <ConfigProvider :theme="antTheme">
    <RouterView />
  </ConfigProvider>
</template>
