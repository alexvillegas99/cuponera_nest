// Cuponeras de DEMO para el entorno LOCAL (mongosh).
//   mongosh --port 27018 enjoy_local scripts/seed-demo-cuponeras.js
// Idempotente (upsert por nombre). Solo para probar el selector de compra.
// La base local se llama enjoy_local (ver MONGO_URL en .env); producción no.
if (db.getName() !== 'enjoy_local') {
  throw new Error('Solo para la base local (enjoy_local)');
}

const now = new Date();
const prov = (n) => db.provincias.findOne({ nombre: n });
const ciu = (n) => db.ciudades.findOne({ nombre: n });

const provinciales = [
  ['Tungurahua', '25.00'], ['Pichincha', '30.00'], ['Guayas', '30.00'], ['Azuay', '25.00'],
  ['Chimborazo', '20.00'], ['Cotopaxi', '20.00'], ['Imbabura', '20.00'], ['Manabí', '25.00'],
  ['El Oro', '20.00'], ['Loja', '20.00'], ['Pastaza', '15.00'], ['Napo', '15.00'],
  ['Santo Domingo de los Tsáchilas', '20.00'], ['Esmeraldas', '20.00'],
];
const cantonales = [
  ['Ambato', '18.00'], ['Baños de Agua Santa', '15.00'], ['Pelileo', '12.00'],
  ['Riobamba', '15.00'], ['Latacunga', '15.00'], ['Quito', '22.00'],
];

let n = 0;
for (const [nombre, precio] of provinciales) {
  const p = prov(nombre);
  if (!p) { print('Provincia no encontrada: ' + nombre); continue; }
  db.versioncuponeras.updateOne(
    { nombre: `Cuponera ${nombre} 2026` },
    { $set: { estado: true, precio, descripcion: `Válida en todos los locales afiliados de ${nombre}.`,
              provinciasDisponibles: [p._id], ciudadesDisponibles: [], updatedAt: now },
      $setOnInsert: { createdAt: now } },
    { upsert: true });
  n++;
}
for (const [nombre, precio] of cantonales) {
  const c = ciu(nombre);
  if (!c) { print('Ciudad no encontrada: ' + nombre); continue; }
  db.versioncuponeras.updateOne(
    { nombre: `Cuponera ${nombre} 2026` },
    { $set: { estado: true, precio, descripcion: `Válida en los locales afiliados de ${nombre}.`,
              ciudadesDisponibles: [c._id], provinciasDisponibles: [], updatedAt: now },
      $setOnInsert: { createdAt: now } },
    { upsert: true });
  n++;
}
print(`Cuponeras demo: ${n}`);
