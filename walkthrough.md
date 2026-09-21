# Walkthrough — Comprehensive System Upgrades & Integrity Protections

## 1. P0 — Fix active_ads_count Overwrite by Creative Sync (Offer Miner)

### Overview & Root Cause Analysis Report
- **ROOT CAUSE**: When running "BUSCAR NOVOS ANÚNCIOS / SINCRONIZAR CRIATIVOS", `captureMetaAdsCreatives` in `src/lib/meta-ads/capture.ts` calculated `allAdsWithMedia.length` (the count of ad records downloaded in that session, e.g. 28) and called `dbService.updateOffer(offer.id, { active_ads_count: allAdsWithMedia.length > 0 ? allAdsWithMedia.length : offer.active_ads_count, ... })`. This directly overwrote the offer's scale metric `active_ads_count` (which was 370 for "Desafio Desincha Barriga").
- **EXACT FILE**: `src/lib/meta-ads/capture.ts`
- **EXACT FUNCTION**: `captureMetaAdsCreatives`
- **LINE**: Line 548
- **WHAT OVERWROTE `active_ads_count`**: `allAdsWithMedia.length` (28) overwrote `offer.active_ads_count` (370).
- **WHEN IT HAPPENED**: At step 11 ("RE-QUERY COMPLETE ADS & COMPUTE DISTINCT CREATIVES & DATES") during creative sync completion.

---

### Structural Architectural Fixes Implemented

1. **Domain Boundary & Type-Safety Enforcement (`src/types/index.ts`)**:
   - Created `CreativeMetricsUpdate` interface containing `captured_ads_count`, `captured_unique_creatives`, `unique_creatives_count`, `captured_videos_count`, `captured_images_count`, `stored_media_count`, `last_creatives_capture_at`, etc.
   - **EXPLICITLY OMITTED** `active_ads_count` from `CreativeMetricsUpdate`, preventing any creative service routine from updating scale metrics at compile-time.

2. **Single Source of Truth Service Methods (`src/lib/supabase/db.ts`)**:
   - `updateCreativeMetrics(offerId, metrics: CreativeMetricsUpdate)`: Updates ONLY creative library asset metrics.
   - `updateActiveAdsCount(offerId, count, source: ActiveAdsSource, observedAt?)`: Dedicated active ads metric updater. Validates `source !== 'CREATIVE_SYNC'`, throwing an error if creative sync attempts to invoke it.

3. **Refactored Master Creative Collector (`src/lib/meta-ads/capture.ts`)**:
   - Replaced generic `updateOffer` call with `dbService.updateCreativeMetrics(...)`.
   - Completely removed `active_ads_count` from `capture.ts`.

4. **Scale Tier Integrity (`src/lib/scale-tier.ts`)**:
   - `getOfferScaleTier(activeAds)` strictly consumes `offer.active_ads_count`.
   - `> 200` active ads -> `FULL_SCALE` ("🔥🔥 FULL ESCALA").

5. **AI Tools & MCP Schema Separation (`src/lib/ai-tools/registry.ts`)**:
   - `get_offer` tool schema returns distinct metrics:
     - `activeAdsCount`: Total active ads observed on Meta (Scale metric).
     - `collectedAdsCount`: Ad records collected by SaaS.
     - `uniqueCreativesCount`: Distinct creative assets identified after deduplication.
     - `storedMediaCount`: Media files saved in Storage.

6. **UI Header Metrics & Tooltips (`src/app/offers/[id]/page.tsx` & `TabCreatives.tsx`)**:
   - **ADS ATIVOS**: `offer.active_ads_count` (Subtitle: `Escala na Meta`, Tooltip: *"Número de anúncios ativos observados para a oferta na Meta. Não corresponde ao número de criativos únicos salvos."*).
   - **CRIATIVOS DISTINTOS**: `uniqueCreativesCount` (Subtitle: `Peças únicas identificadas`, Tooltip: *"Quantidade de peças criativas distintas após deduplicação. Vários anúncios podem reutilizar o mesmo criativo."*).

7. **Database Reconciliation & Auto-Restoration (`src/lib/offer/reconciliation.ts`)**:
   - Built `ActiveAdsReconciliationService`. Audited database offers and auto-restored confirmed corruptions from trusted historical snapshots.

---

### Real Real-World Test & Restoration Output (`scratch/test_active_ads_pipeline_fix.ts`)

```
=== TEST SUITE: OFFER MINER ACTIVE ADS INTEGRITY & BOUNDARIES ===

--- TEST 1: Creative Sync Isolation ---
Initial Offer created with active_ads_count = 347 (ID: 26a2f36c-dd9b-446e-8d68-43e0278d3ae3)
After Creative Sync:
- active_ads_count: 347 (Expected: 347)
- captured_ads_count: 28 (Expected: 28)
- unique_creatives_count: 27 (Expected: 27)
- stored_media_count: 28 (Expected: 28)
✅ TEST 1, 2, 3 PASSED: active_ads_count remained 347 after creative sync!

--- TEST 4: Authorized Active Ads Update ---
Updated active_ads_count: 355 (Expected: 355)
Source: META_ADS_LIBRARY (Expected: META_ADS_LIBRARY)
✅ TEST 4 PASSED: updateActiveAdsCount updated active_ads_count to 355 with provenance.

--- TEST 5: Scale Tier Classification ---
Scale Tier for 355 active ads: FULL_SCALE (🔥🔥 FULL ESCALA)
Scale Tier for 28 active ads: NORMAL ()
✅ TEST 5 PASSED: Scale Tier uses active_ads_count (355 = FULL_SCALE, 28 = NORMAL).

--- TEST 6: Invariant Enforcement (CREATIVE_SYNC Source Rejection) ---
Caught expected invariant error: "SECURITY/INTEGRITY VIOLATION: Creative Sync cannot update active_ads_count..."
✅ TEST 6 PASSED: CREATIVE_SYNC source correctly rejected!

--- TEST 7: Executing Real DB Active Ads Reconciliation ---
[RECONCILIATION RESTORED] Offer "Desafio Desincha Barriga": active_ads_count restored 28 -> 370
Total DB Offers Audited: 69
Confirmed Corruptions Found: 1
Restored Offers Count: 1

📌 DESAFIO DESINCHA BARRIGA POST-RESTORATION STATE:
- active_ads_count: 370
- captured_ads_count: 28
- captured_unique_creatives: 27
- stored_media_count: 28
- Scale Tier: 🔥🔥 FULL ESCALA
```

---

## 2. P0 — Definitive Fix for Offer Miner Mapping Pipeline

- `NOVA OFERTA IMPORTADA ≠ OFERTA MAPEADA`.
- Initialized all imported offers cleanly as `lp_mapping_status = 'NOT_MAPPED'`, `checkout_discovery_status = 'NOT_PROCESSED'`, `checkout_mapping_status = 'NOT_MAPPED'`.
- Built `MappingReconciliationService` and cleaned 27 false positives while preserving 39 valid mappings.

---

## 3. Knowledge Library ("Biblioteca do Cérebro")

- Multi-modal Knowledge Library with chapters, tags, cross-mission context injection, and strict cross-mission isolation.

---

## Summary of Completed Tasks & Build Verification

| Task | Status | Verification |
|---|---|---|
| **Active Ads Integrity & Boundary Isolation** | ✅ Complete | `scratch/test_active_ads_pipeline_fix.ts` passed (code 0) |
| **Real DB Restoration ("Desafio Desincha Barriga")** | ✅ Complete | `active_ads_count` restored to 370 (FULL_SCALE) |
| **Offer Mapping Pipeline Fix** | ✅ Complete | `scratch/test_mapping_pipeline_reconcile.ts` passed (code 0) |
| **Knowledge Library ("Biblioteca do Cérebro")** | ✅ Complete | `scratch/test_knowledge_library.ts` passed (code 0) |
| **TypeScript Build Check (`npx tsc --noEmit`)** | ✅ Complete | Exit code 0 |
| **Next Dev Server Daemon Restart** | ✅ Complete | Running cleanly on http://localhost:3000 |
