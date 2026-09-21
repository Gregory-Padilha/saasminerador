import fs from 'fs';
import path from 'path';

const PLAYBOOKS_DIR = path.join(process.cwd(), 'src', 'lib', 'ai-brain', 'playbooks');

export function loadPlaybookFile(filename: string): string {
  try {
    const filePath = path.join(PLAYBOOKS_DIR, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (err) {
    console.warn(`Warning loading playbook file ${filename}:`, err);
  }
  return '';
}

export const PLAYBOOK_MAP: Record<string, string> = {
  DISCOVER: 'discover-modelable-offers.md',
  MODEL: 'model-offer.md',
  EXTRACT_DNA: 'extract-offer-dna.md',
  CHANGE_AVATAR: 'change-avatar.md',
  CHANGE_ANGLE: 'change-angle.md',
};

export function getPlaybookByAction(actionKey: string): string {
  const filename = PLAYBOOK_MAP[actionKey] || 'discover-modelable-offers.md';
  return loadPlaybookFile(filename);
}
