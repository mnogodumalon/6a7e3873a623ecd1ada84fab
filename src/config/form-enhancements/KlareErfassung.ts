import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'titel',
    'kategorie',
    'status',
    'datum',
    'beschreibung',
    'anmerkungen',
  ],
  defaults: {
    'datum': { kind: 'today' },
    'status': { kind: 'lookup', key: 'offen', label: 'Offen' },
    'kategorie': { kind: 'lookup', key: 'allgemein', label: 'Allgemein' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
