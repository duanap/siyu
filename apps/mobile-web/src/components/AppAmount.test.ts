import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AppAmount from './AppAmount.vue';

describe('AppAmount', () => {
  it('uses entry type rather than amount sign for semantics', () => {
    const income = mount(AppAmount, { props: { amountCent: 100, type: 'INCOME' } });
    const expense = mount(AppAmount, { props: { amountCent: 100, type: 'EXPENSE' } });
    expect(income.text()).toBe('+¥ 1.00');
    expect(income.attributes('aria-label')).toContain('收入');
    expect(expense.text()).toBe('-¥ 1.00');
    expect(expense.classes()).toContain('expense');
  });
});
