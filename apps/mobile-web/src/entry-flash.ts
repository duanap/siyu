import { ref } from 'vue';

const createdEntryId = ref('');

export function markEntryCreated(id: string): void {
  createdEntryId.value = id;
}

export function consumeCreatedEntryId(): string {
  const id = createdEntryId.value;
  createdEntryId.value = '';
  return id;
}
