// ==============================================================================
// OFFER MINER - EVENT-DRIVEN LIVE DATA SYNC SYSTEM
// ==============================================================================

export type OfferEventType =
  | 'offer_updated'
  | 'lp_mapped'
  | 'checkout_mapped'
  | 'creatives_captured'
  | 'global_sync';

export interface OfferEventPayload {
  offerId?: string;
  type: OfferEventType;
  source?: string;
  timestamp: string;
}

type Listener = (payload: OfferEventPayload) => void;

class OfferEventManager {
  private listeners: Set<Listener> = new Set();

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notifyOfferUpdated(offerId: string, source?: string) {
    const payload: OfferEventPayload = {
      offerId,
      type: 'offer_updated',
      source,
      timestamp: new Date().toISOString(),
    };
    this.listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('[OfferEvents] Listener error:', err);
      }
    });
  }

  public notifyGlobalSync(source?: string) {
    const payload: OfferEventPayload = {
      type: 'global_sync',
      source,
      timestamp: new Date().toISOString(),
    };
    this.listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('[OfferEvents] Listener error:', err);
      }
    });
  }
}

export const offerEvents = new OfferEventManager();

export function notifyOfferUpdated(offerId: string, source?: string) {
  offerEvents.notifyOfferUpdated(offerId, source);
}

export function notifyGlobalSync(source?: string) {
  offerEvents.notifyGlobalSync(source);
}
