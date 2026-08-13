// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface KlareErfassung {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    titel?: string;
    beschreibung?: string;
    kategorie?: LookupValue;
    datum?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
    anmerkungen?: string;
    anhang?: string;
  };
}

export const APP_IDS = {
  KLARE_ERFASSUNG: '6a7e385d454d42fd22634424',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'klare_erfassung': {
    kategorie: [{ key: "allgemein", label: "Allgemein" }, { key: "wichtig", label: "Wichtig" }, { key: "dringend", label: "Dringend" }, { key: "optional", label: "Optional" }],
    status: [{ key: "offen", label: "Offen" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "abgeschlossen", label: "Abgeschlossen" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'klare_erfassung': {
    'titel': 'string/text',
    'beschreibung': 'string/textarea',
    'kategorie': 'lookup/select',
    'datum': 'date/date',
    'status': 'lookup/radio',
    'anmerkungen': 'string/textarea',
    'anhang': 'file',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateKlareErfassung = StripLookup<KlareErfassung['fields']>;