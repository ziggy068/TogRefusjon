"use client";
import { useState, useRef, ChangeEvent } from "react";
import { validateFile, FileValidationOptions } from "@/lib/validation";

export interface FileUploadProps {
  label?: string;
  helperText?: string;
  onFileSelect: (file: File | null) => void;
  accept?: string;
  validationOptions?: FileValidationOptions;
  disabled?: boolean;
  required?: boolean;
}

export default function FileUpload({
  label = "Last opp fil",
  helperText = "Støttede formater: JPG, PNG, PDF (maks 10 MB)",
  onFileSelect,
  accept = "image/jpeg,image/png,application/pdf",
  validationOptions,
  disabled = false,
  required = false,
}: FileUploadProps) {
  const [error, setError] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    processFile(file);
  };

  const processFile = (file: File | null) => {
    setError("");

    if (!file) {
      setSelectedFile(null);
      onFileSelect(null);
      return;
    }

    const validation = validateFile(file, validationOptions);

    if (!validation.isValid) {
      setError(validation.error || "Ugyldig fil");
      setSelectedFile(null);
      onFileSelect(null);
      return;
    }

    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0] || null;
    processFile(file);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setError("");
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center
          transition-colors
          ${
            isDragging
              ? "border-gray-900 bg-gray-50"
              : error
              ? "border-red-300 bg-red-50"
              : "border-gray-300 bg-white"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!disabled ? handleButtonClick : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleFileChange}
          disabled={disabled}
        />

        {selectedFile ? (
          <div className="space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-sm font-medium text-gray-900">
              {selectedFile.name}
            </p>
            <p className="text-xs text-gray-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Fjern fil
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full">
              <span className="text-2xl">📄</span>
            </div>
            <p className="text-sm text-gray-700">
              <span className="font-medium text-gray-900">Klikk for å laste opp</span>
              {" "}eller dra og slipp fil her
            </p>
            {helperText && (
              <p className="text-xs text-gray-500">{helperText}</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
