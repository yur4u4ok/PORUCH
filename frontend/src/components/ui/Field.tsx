import clsx from "clsx";
import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useTranslation } from "react-i18next";

import styles from "./Field.module.css";

interface FieldWrapperProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  id: string;
  children: ReactNode;
  counter?: ReactNode;
}

function FieldWrapper({ label, hint, error, id, children, counter }: FieldWrapperProps) {
  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      {children}
      {counter && <span className={styles.counter}>{counter}</span>}
      {hint && !error && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}

type BaseProps = { label?: ReactNode; hint?: ReactNode; error?: string };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & BaseProps>(
  function Input({ label, hint, error, id, className, type, ...rest }, ref) {
    const { t } = useTranslation();
    const autoId = useId();
    const inputId = id ?? autoId;
    // Password fields get a show/hide toggle.
    const [visible, setVisible] = useState(false);
    const isPassword = type === "password";
    const input = (
      <input
        ref={ref}
        id={inputId}
        type={isPassword && visible ? "text" : type}
        className={clsx(styles.control, error && styles.invalid, isPassword && styles.withToggle, className)}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...rest}
      />
    );
    return (
      <FieldWrapper label={label} hint={hint} error={error} id={inputId}>
        {isPassword ? (
          <div className={styles.passwordWrap}>
            {input}
            <button
              type="button"
              className={styles.reveal}
              aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
              aria-pressed={visible}
              aria-controls={inputId}
              onClick={() => setVisible((v) => !v)}
            >
              {visible ? "🙈" : "👁"}
            </button>
          </div>
        ) : (
          input
        )}
      </FieldWrapper>
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & BaseProps & { showCounter?: boolean; valueLength?: number }
>(function Textarea(
  { label, hint, error, id, className, showCounter, valueLength, maxLength, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      id={inputId}
      counter={showCounter && maxLength ? `${valueLength ?? 0}/${maxLength}` : undefined}
    >
      <textarea
        ref={ref}
        id={inputId}
        maxLength={maxLength}
        className={clsx(styles.control, error && styles.invalid, className)}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...rest}
      />
    </FieldWrapper>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & BaseProps>(
  function Select({ label, hint, error, id, className, children, ...rest }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <FieldWrapper label={label} hint={hint} error={error} id={inputId}>
        <select ref={ref} id={inputId} className={clsx(styles.control, className)} {...rest}>
          {children}
        </select>
      </FieldWrapper>
    );
  },
);

export function Switch({
  label,
  checked,
  onChange,
  disabled,
  description,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  description?: ReactNode;
}) {
  return (
    <label className={styles.switch}>
      <span>
        {label}
        {description && (
          <span className={clsx(styles.hint)} style={{ display: "block" }}>
            {description}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
