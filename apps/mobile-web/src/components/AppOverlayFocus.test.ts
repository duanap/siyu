import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('ant-design-vue/es/drawer', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      name: 'DrawerStub',
      props: { open: Boolean },
      emits: ['afterOpenChange', 'close'],
      setup(_props, { slots }) {
        return () =>
          h('div', { class: 'ant-drawer-content', role: 'dialog', tabindex: -1 }, [
            h('button', { class: 'ant-drawer-close' }),
            slots.default?.(),
          ]);
      },
    }),
  };
});

vi.mock('ant-design-vue/es/modal', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      name: 'ModalStub',
      props: { open: Boolean },
      emits: ['afterClose', 'ok', 'cancel'],
      setup(_props, { slots }) {
        return () =>
          h('div', { class: 'ant-modal-content', role: 'dialog', tabindex: -1 }, [
            h('button', { class: 'ant-modal-close' }),
            h('div', { class: 'ant-modal-body' }, slots.default?.()),
          ]);
      },
    }),
  };
});

import AppDialog from './AppDialog.vue';
import AppDrawer from './AppDrawer.vue';

afterEach(() => {
  document.body.innerHTML = '';
});

function connectedOpener() {
  const button = document.createElement('button');
  document.body.append(button);
  button.focus();
  return button;
}

describe('overlay focus restoration', () => {
  it('restores the drawer opener after the close transition', async () => {
    const opener = connectedOpener();
    const wrapper = mount(AppDrawer, { props: { open: false, title: '筛选账目' } });

    await wrapper.setProps({ open: true });
    (wrapper.findComponent({ name: 'DrawerStub' }).element as HTMLElement).focus();
    await wrapper.setProps({ open: false });
    wrapper.findComponent({ name: 'DrawerStub' }).vm.$emit('afterOpenChange', false);

    expect(document.activeElement).toBe(opener);
  });

  it('restores the dialog opener after the close transition', async () => {
    const opener = connectedOpener();
    const wrapper = mount(AppDialog, { props: { open: false, title: '确认删除' } });

    await wrapper.setProps({ open: true });
    (wrapper.findComponent({ name: 'ModalStub' }).element as HTMLElement).focus();
    await wrapper.setProps({ open: false });
    wrapper.findComponent({ name: 'ModalStub' }).vm.$emit('afterClose');

    expect(document.activeElement).toBe(opener);
  });
});
