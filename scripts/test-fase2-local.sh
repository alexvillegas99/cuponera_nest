#!/usr/bin/env bash
# Fase 2 (pagos y canje) contra el ENTORNO LOCAL + simulador de pasarelas en :4999.
# Requiere: API local con PAYPHONE_API_URL/PAYPAL_API_URL=http://localhost:4999
# Uso: bash scripts/test-fase2-local.sh
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
API=${API:-http://localhost:4000/api}
FAKE=http://localhost:4999
M() { mongosh --port 27018 --quiet enjoy_local --eval "$1"; }
[[ $(M 'db.getName()') == enjoy_local ]] || { echo "Solo enjoy_local"; exit 1; }
pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ✅ %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  ❌ %s\n' "$1"; }
eq()  { [[ "$2" == "$3" ]] && ok "$1 ($2)" || bad "$1 (obtenido $2, esperado $3)"; }
login() { curl -s -X POST "$API$1" -H 'content-type: application/json' -d "{\"correo\":\"$2\",\"clave\":\"$3\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))"; }
set_fake() { curl -s -X POST $FAKE/__set -H 'content-type: application/json' -d "$1" >/dev/null; }
J='content-type: application/json'

CLI=$(login /auth/login/cliente "$SEED_CLIENTE_EMAIL" "$SEED_CLIENTE_PASSWORD")
ADM=$(login /auth/login "$SEED_ADMIN_EMAIL" "$SEED_ADMIN_PASSWORD")
LOC=$(login /auth/login "$SEED_LOCAL_EMAIL" "$SEED_LOCAL_PASSWORD")
CID=$(M "db.clientes.findOne({email:'$SEED_CLIENTE_EMAIL'})._id.toString()")
OTRO=$(M "(db.clientes.findOne({email:{\$ne:'$SEED_CLIENTE_EMAIL'}})||{_id:new ObjectId()})._id.toString()")
NOMBRE='Cuponera Ambato 2026'
PRECIO=$(M "Number(db.versioncuponeras.findOne({nombre:'$NOMBRE'}).precio).toFixed(2)")
CENTS=$(python3 -c "print(round(float('$PRECIO')*100))")
cupones() { M "db.cupons.countDocuments({\$or:[{cliente:ObjectId('$CID')},{cliente:'$CID'}]})"; }

iniciar() { # → clientTransactionId
  curl -s -X POST $API/pagos/payphone/iniciar -H "authorization: Bearer $CLI" -H "$J" \
    -d "{\"clienteId\":\"$OTRO\",\"nombreCliente\":\"Cliente Prueba\",\"emailCliente\":\"$SEED_CLIENTE_EMAIL\",\"cuponeraNombre\":\"$NOMBRE\",\"cuponeraPrecio\":\"0.01\"}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin).get('clientTransactionId',''))"
}
pago() { M "const p=db.pagos.findOne({clientTransactionId:'$1'}); print(p.$2)"; }

echo "── PayPhone: precio y cliente del servidor"
T1=$(iniciar)
eq "Monto = precio real aunque la app mande 0.01" "$(pago $T1 'monto.toFixed(2)')" "$PRECIO"
eq "Cliente = el de la sesión (se ignora clienteId ajeno)" "$(pago $T1 'cliente.toString()')" "$CID"
eq "Inicio sin sesión" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/pagos/payphone/iniciar -H "$J" -d '{}')" 401

echo "── PayPhone: webhook falso (el proveedor dice que NO está pagado)"
set_fake '{"payphone":{"statusCode":2,"amount":'$CENTS'}}'
ANTES=$(cupones)
curl -s -X POST $API/pagos/payphone/webhook -H "$J" -d "{\"clientTransactionId\":\"$T1\",\"transactionId\":123,\"statusCode\":3}" >/dev/null
eq "Webhook con statusCode 3 inventado no crea cupón" "$(cupones)" "$ANTES"
eq "…y el pago queda RECHAZADO" "$(pago $T1 status)" "RECHAZADO"

echo "── PayPhone: proveedor aprueba pero con otro monto"
T2=$(iniciar); set_fake '{"payphone":{"statusCode":3,"amount":1}}'
ANTES=$(cupones)
curl -s "$API/pagos/payphone/resultado?id=555&clientTransactionId=$T2" >/dev/null
eq "Monto distinto al del pago → sin cupón" "$(cupones)" "$ANTES"
eq "…y queda en REVISION (cobrado, no se rechaza)" "$(pago $T2 status)" "REVISION"

echo "── PayPhone: aprobado, resultado dos veces + webhook"
T3=$(iniciar); set_fake '{"payphone":{"statusCode":3,"amount":'$CENTS'}}'
ANTES=$(cupones)
curl -s "$API/pagos/payphone/resultado?id=777&clientTransactionId=$T3" >/dev/null
curl -s "$API/pagos/payphone/resultado?id=777&clientTransactionId=$T3" >/dev/null
curl -s -X POST $API/pagos/payphone/webhook -H "$J" -d "{\"clientTransactionId\":\"$T3\",\"transactionId\":777}" >/dev/null
eq "Tres confirmaciones → un solo cupón" "$(( $(cupones) - ANTES ))" 1
eq "Pago APROBADO con cupón EMITIDO" "$(pago $T3 status)/$(pago $T3 cuponEstado)" "APROBADO/EMITIDO"
set_fake '{"payphone":{"statusCode":2,"amount":'$CENTS'}}'
curl -s -X POST $API/pagos/payphone/webhook -H "$J" -d "{\"clientTransactionId\":\"$T3\",\"transactionId\":777}" >/dev/null
eq "Un 'no aprobado' posterior no degrada el pago" "$(pago $T3 status)" "APROBADO"

echo "── PayPhone: página de resultado sin inyección"
HTML=$(curl -s "$API/pagos/payphone/resultado?id=1&clientTransactionId=%3Cscript%3Ealert(1)%3C%2Fscript%3E")
[[ "$HTML" != *"<script>alert(1)"* ]] && ok "clientTransactionId malicioso no se inserta en la página" || bad "Se insertó el script en la página"

echo "── PayPal: precio real, captura doble y monto distinto"
crear_pp() {
  curl -s -X POST $API/pagos/paypal/crear -H "authorization: Bearer $CLI" -H "$J" \
    -d "{\"clienteId\":\"$OTRO\",\"nombreCliente\":\"Cliente Prueba\",\"emailCliente\":\"$SEED_CLIENTE_EMAIL\",\"cuponeraNombre\":\"$NOMBRE\",\"cuponeraPrecio\":\"0.01\",\"returnUrl\":\"https://x\",\"cancelUrl\":\"https://x\"}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin).get('orderId',''))"
}
set_fake '{"paypal":{"status":"COMPLETED","currency":"USD","value":null}}'
O1=$(crear_pp)
eq "Orden PayPal por el precio real" "$(M "db.pagos.findOne({transactionId:'$O1'}).monto.toFixed(2)")" "$PRECIO"
ANTES=$(cupones)
curl -s -X POST $API/pagos/paypal/capturar/$O1 -H "authorization: Bearer $CLI" >/dev/null
curl -s -X POST $API/pagos/paypal/webhook -H "$J" -d "{\"event_type\":\"CHECKOUT.ORDER.APPROVED\",\"resource\":{\"id\":\"$O1\"}}" >/dev/null
curl -s -X POST $API/pagos/paypal/capturar/$O1 -H "authorization: Bearer $CLI" >/dev/null
eq "Captura + webhook + captura → un solo cupón" "$(( $(cupones) - ANTES ))" 1
set_fake '{"paypal":{"status":"COMPLETED","currency":"USD","value":"1.00"}}'
O2=$(crear_pp); ANTES=$(cupones)
curl -s -X POST $API/pagos/paypal/capturar/$O2 -H "authorization: Bearer $CLI" >/dev/null
eq "Captura por otro monto → sin cupón" "$(cupones)" "$ANTES"
eq "…y queda en REVISION (cobrado, no se rechaza)" "$(M "db.pagos.findOne({transactionId:'$O2'}).status")" "REVISION"
set_fake '{"paypal":{"status":"PENDING","currency":"USD","value":null}}'
O3=$(crear_pp); ANTES=$(cupones)
curl -s -X POST $API/pagos/paypal/capturar/$O3 -H "authorization: Bearer $CLI" >/dev/null
eq "Captura PENDING → sin cupón y el pago sigue PENDIENTE" "$(cupones)/$(M "db.pagos.findOne({transactionId:'$O3'}).status")" "$ANTES/PENDIENTE"
set_fake '{"paypal":{"status":"COMPLETED","currency":"USD","value":null}}'
curl -s -X POST $API/pagos/paypal/webhook -H "$J" -d "{\"event_type\":\"PAYMENT.CAPTURE.COMPLETED\",\"resource\":{\"id\":\"CAPTURA-X\",\"supplementary_data\":{\"related_ids\":{\"order_id\":\"$O3\"}}}}" >/dev/null
eq "Webhook CAPTURE.COMPLETED después → aprobado y un cupón" "$(( $(cupones) - ANTES ))/$(M "db.pagos.findOne({transactionId:'$O3'}).status")" "1/APROBADO"

echo "── Pago aprobado sin cupón: reemisión segura"
T5=$(iniciar)
M "db.pagos.updateOne({clientTransactionId:'$T5'},{\$set:{status:'APROBADO',cuponEstado:'ERROR',cuponError:'simulado',cuponIntentoEn:null}})" >/dev/null
ANTES=$(cupones)
eq "Sin sesión de admin no se puede reemitir" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/pagos/admin/x/reemitir -H "authorization: Bearer $CLI")" 403
PID=$(M "db.pagos.findOne({clientTransactionId:'$T5'})._id.toString()")
curl -s -X POST $API/pagos/admin/$PID/reemitir -H "authorization: Bearer $ADM" >/dev/null
M "db.pagos.updateOne({_id:ObjectId('$PID')},{\$set:{cuponEstado:'ERROR',cuponIntentoEn:null}})" >/dev/null
curl -s -X POST $API/pagos/admin/$PID/reemitir -H "authorization: Bearer $ADM" >/dev/null
eq "Reemitir dos veces → un solo cupón" "$(( $(cupones) - ANTES ))" 1
eq "…y queda EMITIDO" "$(pago $T5 cuponEstado)" "EMITIDO"
eq "Aparece en 'por atender' antes y ya no después" "$(curl -s $API/pagos/admin/por-atender -H "authorization: Bearer $ADM" | python3 -c "import sys,json;print(any(p.get('clientTransactionId')=='$T5' for p in json.load(sys.stdin)))")" False

echo "── Pagos aprobados ANTES del cambio (sin cuponEstado)"
T7=$(iniciar)
M "db.pagos.updateOne({clientTransactionId:'$T7'},{\$set:{status:'APROBADO'},\$unset:{cuponEstado:''}})" >/dev/null
PID7=$(M "db.pagos.findOne({clientTransactionId:'$T7'})._id.toString()")
ANTES=$(cupones)
R=$(curl -s -X POST $API/pagos/admin/$PID7/reemitir -H "authorization: Bearer $ADM")
curl -s "$API/pagos/payphone/resultado?id=1&clientTransactionId=$T7" >/dev/null
curl -s -X POST $API/pagos/payphone/webhook -H "$J" -d "{\"clientTransactionId\":\"$T7\",\"transactionId\":1}" >/dev/null
eq "Reemitir/recargar/webhook no crean cupón para pagos antiguos" "$(( $(cupones) - ANTES ))" 0
eq "…reemitir responde ANTERIOR" "$(echo $R | python3 -c "import sys,json;print(json.load(sys.stdin).get('estado'))")" ANTERIOR
eq "…y no aparece en 'por atender'" "$(curl -s $API/pagos/admin/por-atender -H "authorization: Bearer $ADM" | python3 -c "import sys,json;print(any(p.get('clientTransactionId')=='$T7' for p in json.load(sys.stdin)))")" False
eq "Reemitir con id inválido" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/pagos/admin/xx/reemitir -H "authorization: Bearer $ADM")" 400

echo "── Reemisiones simultáneas"
T8=$(iniciar)
M "db.pagos.updateOne({clientTransactionId:'$T8'},{\$set:{status:'APROBADO',cuponEstado:'ERROR',cuponIntentoEn:null}})" >/dev/null
PID8=$(M "db.pagos.findOne({clientTransactionId:'$T8'})._id.toString()")
ANTES=$(cupones)
for i in 1 2 3; do curl -s -o /dev/null -X POST $API/pagos/admin/$PID8/reemitir -H "authorization: Bearer $ADM" & done; wait
eq "3 reemisiones a la vez → un cupón" "$(( $(cupones) - ANTES ))" 1

echo "── Resolver un pago en REVISION"
PID2=$(M "db.pagos.findOne({clientTransactionId:'$T2'})._id.toString()")
ANTES=$(cupones)
curl -s -X POST $API/pagos/admin/$PID2/resolver -H "authorization: Bearer $ADM" -H "$J" -d '{"accion":"aprobar","nota":"monto verificado"}' >/dev/null
curl -s -X POST $API/pagos/admin/$PID2/resolver -H "authorization: Bearer $ADM" -H "$J" -d '{"accion":"aprobar"}' >/dev/null
eq "Aprobar la revisión (dos veces) → un cupón" "$(( $(cupones) - ANTES ))/$(pago $T2 status)" "1/APROBADO"

echo "── Reintento de emisión de una solicitud"
SID=$(M "db.solicitudes_cuponera.findOne({observaciones:'PRUEBA-LOCAL',estado:'APROBADO'})._id.toString()")
eq "Solo si tuvo error de emisión" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/solicitudes-cuponera/$SID/emitir -H "authorization: Bearer $ADM")" 400

echo "── Webhook con la respuesta de OTRA transacción"
T6=$(iniciar); set_fake '{"payphone":{"statusCode":2,"amount":'$CENTS',"txn":"ENJ-otra-cosa"}}'
curl -s -X POST $API/pagos/payphone/webhook -H "$J" -d "{\"ClientTransactionId\":\"$T6\",\"TransactionId\":999}" >/dev/null
eq "No toca el pago (PascalCase aceptado)" "$(pago $T6 status)" "PENDIENTE"
set_fake '{"payphone":{"statusCode":3,"amount":'$CENTS'}}'

echo "── Formulario de pago"
eq "txn con operador de Mongo" "$(curl -g -s -o /dev/null -w '%{http_code}' "$API/pagos/payphone/formulario?txn[\$ne]=x")" 400
eq "Formulario de un pago ya aprobado" "$(curl -s -o /dev/null -w '%{http_code}' "$API/pagos/payphone/formulario?txn=$T3")" 400
eq "Formulario de un pago pendiente" "$(curl -s -o /dev/null -w '%{http_code}' "$API/pagos/payphone/formulario?txn=$T6")" 200

echo "── Canje: sesión, ámbito por local y doble canje simultáneo"
DIDI=$(M 'db.usuarios.findOne({nombre:/Didi/})._id.toString()')
CUP=$(M "db.cupons.findOne({\$or:[{cliente:ObjectId('$CID')},{cliente:'$CID'}],estado:'activo'},{_id:1},{sort:{createdAt:-1}})._id.toString()")
M "db.historicocupons.deleteMany({cupon:{\$in:['$CUP',ObjectId('$CUP')]},usuario:{\$in:['$DIDI',ObjectId('$DIDI')]}}); db.cupons.updateOne({_id:ObjectId('$CUP')},{\$pull:{localesCanjeados:'$DIDI'}})" >/dev/null
BODY="{\"cupon\":\"$CUP\",\"usuario\":\"$DIDI\"}"
eq "Canje sin sesión" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/historico -H "$J" -d "$BODY")" 401
eq "Canje con sesión de cliente" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/historico -H "authorization: Bearer $CLI" -H "$J" -d "$BODY")" 403
eq "Admin local canjea en OTRO local" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/historico -H "authorization: Bearer $LOC" -H "$J" -d "$BODY")" 403
eq "Cliente lista todo el histórico" "$(curl -s -o /dev/null -w '%{http_code}' $API/historico -H "authorization: Bearer $CLI")" 403
eq "Admin local lista todo el histórico" "$(curl -s -o /dev/null -w '%{http_code}' $API/historico -H "authorization: Bearer $LOC")" 403
eq "Admin local ve el histórico de OTRO local" "$(curl -s -o /dev/null -w '%{http_code}' $API/historico/get/usuario/$DIDI -H "authorization: Bearer $LOC")" 403
ESC0=$(M "db.cupons.findOne({_id:ObjectId('$CUP')}).numeroDeEscaneos")
for i in 1 2 3 4 5; do
  curl -s -o /tmp/enjoy_canje_$i -w '%{http_code}\n' -X POST $API/historico -H "authorization: Bearer $ADM" -H "$J" -d "$BODY" &
done > /tmp/enjoy_canje_codes; wait
OKS=$(grep -c '^201$' /tmp/enjoy_canje_codes)
eq "5 canjes simultáneos en el mismo local → 1 aceptado" "$OKS" 1
eq "…el contador sube solo 1" "$(( $(M "db.cupons.findOne({_id:ObjectId('$CUP')}).numeroDeEscaneos") - ESC0 ))" 1
Q="db.historicocupons.countDocuments({cupon:{\$in:['$CUP',ObjectId('$CUP')]},usuario:{\$in:['$DIDI',ObjectId('$DIDI')]}})"
eq "…y hay un solo registro en el histórico" "$(M "$Q")" 1

echo; echo "Resultado: $pass OK, $fail fallos"
exit $fail
