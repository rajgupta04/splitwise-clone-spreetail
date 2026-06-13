const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const IMPORT_ITEM_STATUS = {
  PENDING: 'pending',
  CLEAN: 'clean',
  FLAGGED: 'flagged',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ERROR: 'error',
};

async function traceFinalize() {
  try {
    // Find an import to trace. Let's get the latest one.
    const csvImport = await prisma.csvImport.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (!csvImport) {
      console.log("No import found.");
      return;
    }
    
    console.log(`Tracing Finalize for Import ID: ${csvImport.id}`);

    const items = await prisma.importItem.findMany({
      where: { importId: csvImport.id }
    });

    console.log(`1. Total ImportItems: ${items.length}`);

    const approved = items.filter((i) => i.status === IMPORT_ITEM_STATUS.APPROVED);
    const rejected = items.filter((i) => i.status === IMPORT_ITEM_STATUS.REJECTED);
    const clean = items.filter((i) => i.status === IMPORT_ITEM_STATUS.CLEAN);
    const flagged = items.filter((i) => i.status === IMPORT_ITEM_STATUS.FLAGGED);
    const errorItems = items.filter((i) => i.status === IMPORT_ITEM_STATUS.ERROR);

    console.log(`2. Approved ImportItems: ${approved.length}`);
    console.log(`3. Rejected ImportItems: ${rejected.length}`);
    console.log(`4. Clean ImportItems: ${clean.length}`);
    console.log(`   (Flagged: ${flagged.length}, Error: ${errorItems.length})`);
    
    console.log(`5. Eligible for import according to finalizeImport logic: ONLY 'approved' items.`);

    // To trace the loop, let's pretend all CLEAN and FLAGGED items are APPROVED by the user
    // (since if they were 0 approved, the loop just does nothing).
    // The user's bug is "No imported expenses appear" AFTER clicking Finalize Import.
    // If they clicked it, they probably approved them.
    const itemsToProcess = [...approved, ...clean, ...flagged];
    console.log(`\nSimulating loop for ${itemsToProcess.length} items (pretending they are approved)...`);

    let createdExpenses = 0;
    let createdSettlements = 0;
    let skippedMissingData = 0;
    let skippedMissingPayerId = 0;
    let skippedMissingDate = 0;

    for (const item of itemsToProcess) {
      const parsed = item.parsedData;
      
      if (!parsed) {
        skippedMissingData++;
        console.log(`Row ${item.rowNumber} skipped: parsedData is null`);
        continue;
      }
      if (!parsed.paidByUserId) {
        skippedMissingPayerId++;
        console.log(`Row ${item.rowNumber} skipped: paidByUserId is null (Payer Name was: "${parsed.paidBy}")`);
        continue;
      }
      if (!parsed.date) {
        skippedMissingDate++;
        console.log(`Row ${item.rowNumber} skipped: date is null`);
        continue;
      }

      if (parsed.isSettlement) {
        createdSettlements++;
      } else {
        createdExpenses++;
      }
    }

    console.log(`\n--- Simulation Results ---`);
    console.log(`6. Expenses that would be created: ${createdExpenses}`);
    console.log(`7. Settlements that would be created: ${createdSettlements}`);
    console.log(`8. Rows skipped silently due to '!parsed || !parsed.paidByUserId || !parsed.date': ${skippedMissingData + skippedMissingPayerId + skippedMissingDate}`);
    
    console.log(`\nRoot cause trace summary:`);
    console.log(`If an item is marked 'clean', it is NOT included in the 'approved' array in finalizeImport.`);
    console.log(`If an item has an unrecognized payer, 'paidByUserId' is null, so it 'continue's silently and creates NO expense.`);

  } catch (err) {
    console.error("Trace failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

traceFinalize();
