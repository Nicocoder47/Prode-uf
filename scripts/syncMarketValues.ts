import { TransfermarktProvider } from '../src/providers/transfermarkt/TransfermarktProvider';

async function main() {
  console.log('🚀 Sincronización de Market Values (Transfermarkt)...');
  const count = await TransfermarktProvider.syncMarketValues();
  console.log(count > 0 ? `✅ ${count} jugadores actualizados.` : 'ℹ️ Sin datos (Transfermarkt no configurado).');
  process.exit(0);
}

main();
