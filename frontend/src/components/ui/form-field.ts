export interface UseFormFieldProps {
  id?: string;
  name?: string;
  label?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
}

export function useFormField(props: UseFormFieldProps = {}) {
  return props;
}

export { FormField } from "./form"