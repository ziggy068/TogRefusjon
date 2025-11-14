"use client";
import { InputHTMLAttributes, forwardRef } from "react";

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, helperText, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              ref={ref}
              type="checkbox"
              className={`
                w-4 h-4 text-gray-900 border-gray-300 rounded
                focus:ring-2 focus:ring-gray-900
                disabled:cursor-not-allowed disabled:opacity-50
                ${error ? "border-red-500" : ""}
                ${className}
              `.trim()}
              {...props}
            />
          </div>
          <div className="ml-3 text-sm">
            <label className="font-medium text-gray-700">
              {label}
              {props.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {helperText && !error && (
              <p className="text-xs text-gray-500 mt-1">{helperText}</p>
            )}
            {error && (
              <p className="text-xs text-red-600 mt-1" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
