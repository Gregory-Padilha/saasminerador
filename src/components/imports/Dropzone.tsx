import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface DropzoneProps {
  onFileLoaded: (buffer: ArrayBuffer, fileName: string) => void;
  isLoading?: boolean;
}

export function Dropzone({ onFileLoaded, isLoading = false }: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setErrorMsg(null);
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const name = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => name.endsWith(ext));

    if (!isValid) {
      setErrorMsg('Formato inválido. Por favor, envie um arquivo .xlsx, .xls ou .csv.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        onFileLoaded(e.target.result, file.name);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Erro ao ler o arquivo. Tente novamente.');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-10 sm:p-14 rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none ${
          isDragOver
            ? 'border-blue-500 bg-blue-500/10 scale-[0.99]'
            : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/90'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              processFile(e.target.files[0]);
            }
          }}
        />

        <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/10">
          {isLoading ? (
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <UploadCloud className="w-8 h-8" />
          )}
        </div>

        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight text-center">
          {isLoading ? 'Lendo e processando planilha...' : 'Arraste seu arquivo Excel do ChatGPT Work'}
        </h3>

        <p className="mt-2 text-xs sm:text-sm text-slate-400 text-center max-w-md">
          Suporte completo para arquivos <span className="text-slate-200 font-semibold">.xlsx</span>,{' '}
          <span className="text-slate-200 font-semibold">.xls</span> e{' '}
          <span className="text-slate-200 font-semibold">.csv</span> gerados pela mineração.
        </p>

        <div className="mt-6 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition active:scale-95">
            <FileSpreadsheet className="w-4 h-4" />
            Selecionar Arquivo
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
