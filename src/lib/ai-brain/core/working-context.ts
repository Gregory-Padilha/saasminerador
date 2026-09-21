import { WorkingContextState } from './types';

/**
 * Extracts offer UUIDs and entity references from conversation message history
 */
export function extractWorkingContext(
  messages: Array<{ role: string; content: string }>,
  attachedOfferIds: string[] = []
): WorkingContextState {
  const activeOfferIdsSet = new Set<string>(attachedOfferIds);
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

  messages.forEach((m) => {
    const matches = m.content.match(uuidRegex);
    if (matches) {
      matches.forEach((id) => activeOfferIdsSet.add(id.toLowerCase()));
    }
  });

  return {
    activeOfferIds: Array.from(activeOfferIdsSet),
  };
}
