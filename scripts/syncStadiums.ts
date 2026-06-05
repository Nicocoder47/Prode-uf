// DEPRECADO: el esquema no tiene tabla `stadiums`. El estadio (y la ciudad) se guardan
// como columnas de texto en `matches` y se sincronizan junto con el fixture.
// Mantener este script como no-op para compatibilidad con npm run sync:stadiums.

async function main() {
  console.log('ℹ️  sync:stadiums esta deprecado. Los estadios se sincronizan con sync:fixtures (columnas matches.stadium / matches.city).');
  process.exit(0);
}

main();
