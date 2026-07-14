import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import EntryListItem from './EntryListItem.vue';
import type { Entry } from '../entry';

const entry: Entry = {
  id: 'entry',
  ledgerId: 'ledger',
  type: 'EXPENSE',
  amountCent: 3250,
  businessDate: '2026-07-14',
  note: '非常长的早餐备注',
  paymentMethod: 'WECHAT',
  sourceType: 'RECURRING_RUN',
  creator: { id: 'user', nickname: '朝暮', avatarUrl: null },
  category: { id: 'category', name: '餐饮', icon: 'food', color: '#E85D5D', isEnabled: false },
  createdAt: '2026-07-14T00:00:00Z',
  updatedAt: '2026-07-14T00:00:00Z',
  version: 1,
  canEdit: false,
  canDelete: false,
};
describe('EntryListItem', () => {
  it('renders disabled category, couple creator and source without sensitive data', async () => {
    const wrapper = mount(EntryListItem, { props: { entry, ledgerType: 'COUPLE' } });
    expect(wrapper.text()).toContain('已停用');
    expect(wrapper.text()).toContain('周期账目');
    expect(wrapper.text()).toContain('朝暮');
    expect(wrapper.text()).toContain('微信');
    expect(wrapper.text()).not.toContain('idempotency');
    await wrapper.trigger('click');
    expect(wrapper.emitted('open')).toHaveLength(1);
  });
});
