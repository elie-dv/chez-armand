import { computed, reactive, ref } from 'vue';
import { appMessages } from '../lib/config';
import { getSupabaseClient } from '../lib/supabase';
import { validateForm } from '../lib/validation';
import type { Database } from '../types/database';
import type { FieldError, FormConfig } from '../types/forms';

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

export function usePublicForm<T extends Record<string, unknown>>(
  initialData: T,
  config: FormConfig<T>,
) {
  const data = reactive({ ...initialData }) as T;
  const errors = ref<Array<FieldError<T>>>([]);
  const status = ref<SubmitState>('idle');
  const message = ref('');

  const errorsByField = computed(() => {
    return Object.fromEntries(errors.value.map((error) => [error.field, error.message])) as Partial<
      Record<keyof T & string, string>
    >;
  });

  function reset() {
    for (const key of Object.keys(initialData) as Array<keyof T>) {
      data[key] = initialData[key];
    }
    errors.value = [];
  }

  function validateField(field: keyof T & string) {
    errors.value = errors.value.filter((error) => error.field !== field);
    const fieldErrors = validateForm({ [field]: data[field] } as T, {
      [field]: config.fields[field],
    } as Record<keyof T & string, (typeof config.fields)[keyof T & string]>);
    errors.value = [...errors.value, ...fieldErrors];
  }

  async function submit() {
    errors.value = validateForm(data, config.fields);
    if (errors.value.length > 0) {
      status.value = 'idle';
      message.value = '';
      return false;
    }

    const client = getSupabaseClient();
    if (!client) {
      status.value = 'error';
      message.value = appMessages.configError;
      return false;
    }

    status.value = 'loading';
    message.value = appMessages.sending;

    const insertResult = config.table === 'villages'
      ? await client
        .from('villages')
        .insert([{ ...(data as unknown as Database['public']['Tables']['villages']['Insert']) }])
      : await client
        .from('jeunes')
        .insert([{ ...(data as unknown as Database['public']['Tables']['jeunes']['Insert']) }]);
    const { error } = insertResult;
    if (error) {
      console.error(`Form ${config.table} error:`, error.code || error.message);
      status.value = 'error';
      message.value = appMessages.genericError;
      return false;
    }

    status.value = 'success';
    message.value = config.successMessage;
    reset();
    return true;
  }

  return {
    data,
    errors,
    errorsByField,
    message,
    reset,
    status,
    submit,
    validateField,
  };
}
