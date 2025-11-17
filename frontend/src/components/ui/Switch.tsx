"use client";
import { forwardRef } from "react";

interface SwitchProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
}

const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ id, checked, onCheckedChange, disabled = false, label, description }, ref) => {
    return (
      <div className="flex items-start gap-3">
        <button
          ref={ref}
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onCheckedChange(!checked)}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full
            transition-colors duration-200 ease-in-out
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${checked ? "bg-primary-500" : "bg-slate-300"}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white shadow-sm
              transition-transform duration-200 ease-in-out
              ${checked ? "translate-x-6" : "translate-x-1"}
            `}
          />
        </button>
        {(label || description) && (
          <div className="flex-1">
            {label && (
              <label
                htmlFor={id}
                className="text-sm font-medium text-slate-900 cursor-pointer"
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Switch.displayName = "Switch";

export default Switch;
