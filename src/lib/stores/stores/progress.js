import { writable } from 'svelte/store';

export const currentOperation = writable(null);
export const isVisible = writable(false);
