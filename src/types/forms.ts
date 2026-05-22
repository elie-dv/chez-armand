import type { Database } from './database';

export type PublicFormTable = Extract<keyof Database['public']['Tables'], 'villages' | 'jeunes'>;

export type FieldRule = {
  required?: boolean;
  label?: string;
  pattern?: RegExp;
  patternMsg?: string;
  type?: 'int';
  min?: number;
  max?: number;
  minMsg?: string;
  maxMsg?: string;
  minLength?: number;
  minLengthMsg?: string;
};

export type FormConfig<T extends Record<string, unknown>> = {
  table: PublicFormTable;
  submitLabel: string;
  successMessage: string;
  fields: Record<keyof T & string, FieldRule>;
};

export type FieldError<T extends Record<string, unknown>> = {
  field: keyof T & string;
  message: string;
};

export type VillageFormData = {
  nom: string | null;
  code_postal: string | null;
  nombre_habitants: number | null;
  contact_nom: string | null;
  contact_email: string | null;
  contact_telephone: string | null;
  date_souhaitee: string | null;
  message: string | null;
};

export type JeuneFormData = {
  prenom: string | null;
  nom: string | null;
  age: number | null;
  email: string | null;
  telephone: string | null;
  motivation: string | null;
};
