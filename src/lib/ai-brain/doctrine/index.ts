import fs from 'fs';
import path from 'path';

const DOCTRINE_DIR = path.join(process.cwd(), 'src', 'lib', 'ai-brain', 'doctrine');

export function loadDoctrineFile(filename: string): string {
  try {
    const filePath = path.join(DOCTRINE_DIR, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (err) {
    console.warn(`Warning loading doctrine file ${filename}:`, err);
  }
  return '';
}

/**
 * Returns always-loaded Core Doctrine files (00, 01, 03, 04, 12)
 */
export function getCoreDoctrine(): string {
  const coreFiles = [
    '00-brain-core.md',
    '01-low-ticket-fundamentals.md',
    '03-offer-dna.md',
    '04-offer-modeling.md',
    '12-evidence-and-risk.md',
  ];
  return coreFiles.map((f) => loadDoctrineFile(f)).filter(Boolean).join('\n\n');
}

/**
 * Returns complete compiled doctrine
 */
export function getCompiledDoctrine(): string {
  const allFiles = [
    '00-brain-core.md',
    '01-low-ticket-fundamentals.md',
    '02-market-validation.md',
    '03-offer-dna.md',
    '04-offer-modeling.md',
    '05-positioning-and-avatar.md',
    '06-product-and-mechanism.md',
    '07-pricing-and-monetization.md',
    '08-creatives-and-hooks.md',
    '09-landing-page.md',
    '10-checkout-and-bumps.md',
    '11-testing-and-scaling.md',
    '12-evidence-and-risk.md',
  ];
  return allFiles.map((f) => loadDoctrineFile(f)).filter(Boolean).join('\n\n');
}
