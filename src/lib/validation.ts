import { appMessages } from './config';
import type { FieldError, FieldRule } from '../types/forms';

export function validateForm<T extends Record<string, unknown>>(
  data: T,
  fieldRules: Record<keyof T & string, FieldRule>,
): Array<FieldError<T>> {
  const errors: Array<FieldError<T>> = [];

  for (const [field, rules] of Object.entries(fieldRules) as Array<[keyof T & string, FieldRule]>) {
    const value = data[field];
    const stringValue = value === null || value === undefined ? '' : String(value).trim();

    if (rules.required) {
      const isEmpty = stringValue === '' || (rules.type === 'int' && Number.isNaN(value));
      if (isEmpty) {
        errors.push({ field, message: appMessages.requiredField });
        continue;
      }
    } else if (stringValue === '') {
      continue;
    }

    if (rules.pattern && !rules.pattern.test(stringValue)) {
      errors.push({ field, message: rules.patternMsg || 'Format invalide.' });
      continue;
    }

    if (rules.type === 'int') {
      const num = Number(value);
      if (rules.min !== undefined && num < rules.min) {
        errors.push({ field, message: rules.minMsg || `La valeur minimale est ${rules.min}.` });
        continue;
      }
      if (rules.max !== undefined && num > rules.max) {
        errors.push({ field, message: rules.maxMsg || `La valeur maximale est ${rules.max}.` });
        continue;
      }
    }

    if (rules.minLength && stringValue.length < rules.minLength) {
      errors.push({ field, message: rules.minLengthMsg || `Minimum ${rules.minLength} caractères.` });
    }
  }

  return errors;
}
