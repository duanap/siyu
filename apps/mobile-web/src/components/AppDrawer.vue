<script setup lang="ts">
import Drawer from 'ant-design-vue/es/drawer';
import { watch } from 'vue';
const props = withDefaults(defineProps<{ open: boolean; title: string; busy?: boolean }>(), {
  busy: false,
});
defineEmits<{ close: [] }>();
let returnFocus: HTMLElement | null = null;

watch(
  () => props.open,
  (open) => {
    if (open && document.activeElement instanceof HTMLElement) returnFocus = document.activeElement;
  },
);

function afterOpenChange(open: boolean) {
  if (!open && returnFocus?.isConnected) returnFocus.focus();
}
</script>
<template>
  <Drawer
    :open="props.open"
    :title="props.title"
    placement="bottom"
    :height="'auto'"
    :content-wrapper-style="{ maxHeight: '92dvh' }"
    :mask-closable="!props.busy"
    @after-open-change="afterOpenChange"
    @close="$emit('close')"
    ><div class="drawer-body"><slot /></div
  ></Drawer>
</template>
<style scoped>
.drawer-body {
  max-height: calc(92dvh - 90px);
  padding-bottom: env(safe-area-inset-bottom);
  overflow: auto;
  color: var(--siyu-text);
}
</style>
