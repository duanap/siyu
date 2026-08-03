import { readonly, ref, type DeepReadonly, type Ref } from 'vue';

const AMOUNT_HIDDEN_KEY = 'siyu-amount-hidden';
const amountHiddenState = ref(false);

export function readAmountHidden(storage: Pick<Storage, 'getItem'> = localStorage): boolean {
  return storage.getItem(AMOUNT_HIDDEN_KEY) === 'true';
}

export function useAmountPrivacy(): {
  amountHidden: DeepReadonly<Ref<boolean>>;
  setAmountHidden: (hidden: boolean) => void;
  toggleAmountHidden: () => void;
} {
  amountHiddenState.value = readAmountHidden();

  function setAmountHidden(hidden: boolean): void {
    amountHiddenState.value = hidden;
    localStorage.setItem(AMOUNT_HIDDEN_KEY, String(hidden));
  }

  return {
    amountHidden: readonly(amountHiddenState),
    setAmountHidden,
    toggleAmountHidden: () => setAmountHidden(!amountHiddenState.value),
  };
}
