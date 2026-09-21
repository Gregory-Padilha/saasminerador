import { deriveDataStatus } from '../src/lib/dossier';
import { Offer } from '../src/types';
import { dbService } from '../src/lib/supabase/db';

export interface RepairReport {
  totalAnalyzed: number;
  currentlyArchived: number;
  manualArchivedPreserved: number;
  autoArchivedRecovered: number;
  ambiguousNeedsReview: number;
  recoveredOffersList: Array<{ id: string; name: string; oldStatus: string; newStatus: string }>;
}

export async function repairAutoArchivedOffers(): Promise<RepairReport> {
  console.log('===================================================');
  console.log('INICIANDO EXECUÇÃO DO AUTO ARCHIVE REPAIR SCRIPT');
  console.log('===================================================\n');

  // Fetch all existing offers from dbService
  const offers: Offer[] = await dbService.getOffers();

  let totalAnalyzed = offers.length;
  let currentlyArchived = 0;
  let manualArchivedPreserved = 0;
  let autoArchivedRecovered = 0;
  let ambiguousNeedsReview = 0;
  const recoveredOffersList: Array<{ id: string; name: string; oldStatus: string; newStatus: string }> = [];

  const offersToUpdate: Offer[] = [];

  for (const offer of offers) {
    const isArchived = offer.status === 'ARQUIVADA' || offer.archived === true;

    if (isArchived) {
      currentlyArchived++;

      // Check for explicit evidence of manual user archiving
      const isManual = offer.archived_by_user === true;

      if (isManual) {
        manualArchivedPreserved++;
        console.log(`[PRESERVED] Oferta "${offer.product_name}" (${offer.id}) foi arquivada manualmente.`);
      } else {
        // Automatically archived improperly - recover it!
        const newStatus = deriveDataStatus(offer);
        const updatedOffer: Offer = {
          ...offer,
          archived: false,
          archived_at: null,
          archived_by_user: false,
          status: newStatus,
          updated_at: new Date().toISOString(),
        };

        offersToUpdate.push(updatedOffer);
        autoArchivedRecovered++;
        recoveredOffersList.push({
          id: offer.id,
          name: offer.product_name,
          oldStatus: offer.status || 'ARQUIVADA',
          newStatus,
        });

        console.log(`[RECOVERED] Oferta "${offer.product_name}" (${offer.id}) revertida de ARQUIVADA -> ${newStatus}`);
      }
    }
  }

  // Persist updates
  for (const updated of offersToUpdate) {
    await dbService.updateOffer(updated.id, updated);
  }

  const report: RepairReport = {
    totalAnalyzed,
    currentlyArchived,
    manualArchivedPreserved,
    autoArchivedRecovered,
    ambiguousNeedsReview,
    recoveredOffersList,
  };

  console.log('\n===================================================');
  console.log('RELATÓRIO DO DATA REPAIR:');
  console.log(`Ofertas analisadas: ${report.totalAnalyzed}`);
  console.log(`Arquivadas atualmente: ${report.currentlyArchived}`);
  console.log(`Arquivamentos manuais preservados: ${report.manualArchivedPreserved}`);
  console.log(`Arquivamentos automáticos revertidos: ${report.autoArchivedRecovered}`);
  console.log(`Ambíguas: ${report.ambiguousNeedsReview}`);
  console.log('===================================================');

  return report;
}

if (require.main === module) {
  repairAutoArchivedOffers()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Erro durante o repair:', err);
      process.exit(1);
    });
}
