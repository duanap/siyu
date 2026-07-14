<script setup lang="ts">
import Modal from 'ant-design-vue/es/modal';
import { watch } from 'vue';
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    busy?: boolean;
  }>(),
  { confirmText: '确认', cancelText: '取消', danger: false, busy: false },
);
defineEmits<{ confirm: []; cancel: [] }>();
let returnFocus: HTMLElement | null = null;

watch(
  () => props.open,
  (open) => {
    if (open && document.activeElement instanceof HTMLElement) returnFocus = document.activeElement;
  },
);

function restoreFocus() {
  if (returnFocus?.isConnected) returnFocus.focus();
}
</script>
<template>
  <Modal
    :open="props.open"
    :title="props.title"
    :ok-text="props.confirmText"
    :cancel-text="props.cancelText"
    :confirm-loading="props.busy"
    :ok-button-props="{ danger: props.danger }"
    :mask-closable="!props.busy"
    @after-close="restoreFocus"
    @ok="$emit('confirm')"
    @cancel="$emit('cancel')"
    ><div class="dialog-content"><slot /></div
  ></Modal>
</template>
<style scoped>
.dialog-content {
  color: var(--siyu-text);
  line-height: 1.7;
  overflow-wrap: anywhere;
}
</style>
