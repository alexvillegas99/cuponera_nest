// scripts/reset-contrato.js
//
// Resetea el estado del contrato de un usuario admin-local por email para
// poder volver a probar el flujo de firma desde cero.
// Uso (desde el directorio del back, con el .env presente):
//
//   node scripts/reset-contrato.js av054558@gmail.com av058554@gmail.com
//
// Toma cada email pasado por CLI, busca el usuario y limpia los campos
// del contrato (contratoAceptado=false + URLs/fechas/versión a null).

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const emails = process.argv.slice(2).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) {
    console.error('Uso: node scripts/reset-contrato.js email1 [email2 ...]');
    process.exit(1);
  }

  const uri =
    process.env.MONGO_URL ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.DB_URI;
  if (!uri) {
    console.error('No se encontró MONGO_URI en .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const col = db.collection('usuarios');

  for (const email of emails) {
    const user = await col.findOne({ email });
    if (!user) {
      console.log(`✗ ${email} — no encontrado`);
      continue;
    }
    const res = await col.updateOne(
      { _id: user._id },
      {
        $set: {
          contratoAceptado: false,
          contratoAceptadoEn: null,
          contratoUrl: null,
          cedulaUrl: null,
          selfieUrl: null,
          contratoVersion: null,
          contratoOmisiones: 0,
        },
      },
    );
    console.log(
      `✓ ${email} (rol=${user.rol}) reseteado — matched=${res.matchedCount} modified=${res.modifiedCount}`,
    );
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error('Error:', e?.message || e);
  process.exit(2);
});
