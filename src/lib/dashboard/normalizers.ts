// ==============================================================================
// OFFER MINER - DASHBOARD CATEGORY & FORMAT NORMALIZERS
// ==============================================================================

export function normalizeNicheName(rawNiche?: string | null): string {
  if (!rawNiche || rawNiche.trim() === '' || /^geral$/i.test(rawNiche.trim())) {
    return 'Sem classificação';
  }
  const clean = rawNiche.trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function normalizeProductType(rawType?: string | null): string {
  if (!rawType || rawType.trim() === '') return 'Outros';
  const clean = rawType.trim();

  if (/ebook|pdf/i.test(clean) && !/molde|planilha/i.test(clean)) {
    return 'Ebook / PDF';
  }
  if (/printable|imprimíve|imprimive|atividade/i.test(clean)) {
    return 'Printable / Imprimíveis';
  }
  if (/molde/i.test(clean)) {
    return 'Moldes em PDF';
  }
  if (/flashcard/i.test(clean)) {
    return 'Flashcards';
  }
  if (/guia|manual|dicionário|dicionario/i.test(clean)) {
    return 'Guias & Manuais';
  }
  if (/planilha|excel|dashboard/i.test(clean)) {
    return 'Planilhas & Dashboards';
  }
  if (/pack|kit|combo|coleção|colecao/i.test(clean)) {
    return 'Kits & Packs';
  }
  if (/receita/i.test(clean)) {
    return 'Receitas';
  }
  if (/curso|videoaula|vídeo\s*aula|vsl/i.test(clean)) {
    return 'Cursos & Videoaulas';
  }

  // Capitalize neatly
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function normalizeCreativeFormat(rawFormat?: string | null): string {
  if (!rawFormat || rawFormat.trim() === '') return 'Imagem';
  const clean = rawFormat.trim();

  if (/vídeo|video|vsl/i.test(clean)) {
    return 'Vídeo';
  }
  if (/imagem|estática|estatica|foto/i.test(clean)) {
    return 'Imagem';
  }
  if (/carrossel|carousel/i.test(clean)) {
    return 'Carrossel';
  }
  if (/misto|híbrido|hibrido/i.test(clean)) {
    return 'Misto';
  }

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}
