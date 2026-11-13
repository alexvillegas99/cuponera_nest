// scripts/fix-codigo-descuento-index.js
//
// Borra el índice viejo `codigoDescuento_1` (unique + sparse) de la colección
// `clientes`. Ese índice rechaza inserts de clientes sin código de promotor
// porque el `default: null` del schema no se ignora con `sparse`. Mongoose
// no elimina índices solo — hay que dropearlo a mano una sola vez.
// Al próximo boot, el schema recrea el índice nuevo (partial, excluyendo nulls).

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const uri =
    process.env.MONGO_URL ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.DB_URI;
  if (!uri) {
    console.error('No se encontró MONGO_URL en .env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const col = mongoose.connection.db.collection('clientes');
  const indexes = await col.indexes();
  console.log('Índices actuales:');
  indexes.forEach((i) => console.log('  •', i.name, JSON.stringify(i.key)));

  const old = indexes.find((i) => i.name === 'codigoDescuento_1');
  if (!old) {
    console.log('✓ No existe índice viejo codigoDescuento_1. Nada que hacer.');
  } else {
    await col.dropIndex('codigoDescuento_1');
    console.log('✓ Índice viejo codigoDescuento_1 borrado.');
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error('Error:', e?.message || e);
  process.exit(2);
});
