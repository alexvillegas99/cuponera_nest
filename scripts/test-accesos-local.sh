#!/usr/bin/env bash
# Matriz de accesos de la Fase 1 contra el ENTORNO LOCAL (localhost:4000, Mongo 27018).
# Uso: bash scripts/test-accesos-local.sh
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
API=${API:-http://localhost:4000/api}
MONGO="mongosh --port 27018 --quiet enjoy_local"
pass=0; fail=0

login() { # $1 ruta, $2 correo, $3 clave
  curl -s -X POST "$API$1" -H 'content-type: application/json' \
    -d "{\"correo\":\"$2\",\"clave\":\"$3\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))"
}
check() { # $1 descripción, $2 esperado (regex), $3.. curl args
  local desc=$1 exp=$2; shift 2
  local code; code=$(curl -s -o /dev/null -w '%{http_code}' "$@")
  if [[ $code =~ ^($exp)$ ]]; then pass=$((pass+1)); printf '  ✅ %-62s %s\n' "$desc" "$code"
  else fail=$((fail+1)); printf '  ❌ %-62s %s (esperado %s)\n' "$desc" "$code" "$exp"; fi
}

ADM=$(login /auth/login "$SEED_ADMIN_EMAIL" "$SEED_ADMIN_PASSWORD")
LOC=$(login /auth/login "$SEED_LOCAL_EMAIL" "$SEED_LOCAL_PASSWORD")
CLI=$(login /auth/login/cliente "$SEED_CLIENTE_EMAIL" "$SEED_CLIENTE_PASSWORD")
H() { echo "authorization: Bearer $1"; }
J='content-type: application/json'
ADMIN_ID=$($MONGO --eval 'db.usuarios.findOne({rol:"admin"})._id.toString()')

echo "── Sin sesión"
check "GET /configuracion (público, sin secretos)"            200 "$API/configuracion"
check "GET /configuracion/payphone_token"                     403 "$API/configuracion/payphone_token"
check "GET /configuracion/admin/todas"                         401 "$API/configuracion/admin/todas"
check "PATCH /usuarios/reset sin OTP verificado"               403 -X PATCH "$API/usuarios/reset" -H "$J" -d "{\"email\":\"$SEED_ADMIN_EMAIL\",\"password\":\"Atacante-123!\"}"
check "PATCH /clientes/reset sin OTP verificado"               403 -X PATCH "$API/clientes/reset" -H "$J" -d "{\"email\":\"$SEED_CLIENTE_EMAIL\",\"password\":\"Atacante-123!\"}"
check "PATCH /usuarios/actualizar/contrasenia/recuperacion"    403 -X PATCH "$API/usuarios/actualizar/contrasenia/recuperacion" -H "$J" -d "{\"email\":\"$SEED_ADMIN_EMAIL\",\"password\":\"Atacante-123!\"}"

echo "── Cliente"
check "GET /roles"                                             403 "$API/roles" -H "$(H $CLI)"
check "POST /roles"                                            403 -X POST "$API/roles" -H "$(H $CLI)" -H "$J" -d '{"nombre":"x","slug":"x","permisos":[]}'
check "POST /versiones"                                        403 -X POST "$API/versiones" -H "$(H $CLI)" -H "$J" -d '{"nombre":"HACK"}'
check "PATCH /configuracion/paypal_secret"                     403 -X PATCH "$API/configuracion/paypal_secret" -H "$(H $CLI)" -H "$J" -d '{"valor":"x"}'
check "GET /solicitudes-cuponera"                              403 "$API/solicitudes-cuponera" -H "$(H $CLI)"
check "GET /clientes/admin"                                    403 "$API/clientes/admin?page=1&limit=1" -H "$(H $CLI)"
check "GET /cupones (todos)"                                   403 "$API/cupones?page=1&limit=1" -H "$(H $CLI)"
check "GET /versiones (catálogo para comprar)"                 200 "$API/versiones" -H "$(H $CLI)"

echo "── Admin local"
check "GET /roles"                                             403 "$API/roles" -H "$(H $LOC)"
check "POST /versiones"                                        403 -X POST "$API/versiones" -H "$(H $LOC)" -H "$J" -d '{"nombre":"HACK"}'
check "GET /clientes/admin (datos de todos los clientes)"      403 "$API/clientes/admin?page=1&limit=1" -H "$(H $LOC)"
check "GET /solicitudes-cuponera"                              403 "$API/solicitudes-cuponera" -H "$(H $LOC)"
check "GET /cupones (todos)"                                   403 "$API/cupones?page=1&limit=1" -H "$(H $LOC)"
check "GET /dashboard-local (su panel)"                        "200|404" "$API/usuarios/users-local/$($MONGO --eval 'db.usuarios.findOne({rol:"admin-local"})._id.toString()')" -H "$(H $LOC)"
check "GET /promociones-flash/mias"                            200 "$API/promociones-flash/mias" -H "$(H $LOC)"

echo "── Admin"
check "GET /roles"                                             200 "$API/roles" -H "$(H $ADM)"
check "GET /configuracion/admin/todas"                         200 "$API/configuracion/admin/todas" -H "$(H $ADM)"
check "GET /solicitudes-cuponera"                              200 "$API/solicitudes-cuponera" -H "$(H $ADM)"
check "GET /clientes/admin"                                    200 "$API/clientes/admin?page=1&limit=1" -H "$(H $ADM)"
check "GET /cupones"                                           200 "$API/cupones?page=1&limit=1" -H "$(H $ADM)"

echo "── Respuestas sin datos sensibles"
leak() { # $1 descripción, $2.. curl args
  local d=$1; shift
  if curl -s "$@" | grep -qE '"\$2[aby]\$|"contratoOtp(Hash)?"|"hashedCode"'; then fail=$((fail+1)); echo "  ❌ $d filtra hash/OTP"
  else pass=$((pass+1)); echo "  ✅ $d sin hash ni OTP"; fi
}
leak "GET /usuarios/:id" "$API/usuarios/$ADMIN_ID"
leak "POST /auth/login" -X POST "$API/auth/login" -H "$J" -d "{\"correo\":\"$SEED_ADMIN_EMAIL\",\"clave\":\"$SEED_ADMIN_PASSWORD\"}"
leak "GET /roles (los permisos conservan su 'clave')" "$API/roles" -H "$(H $ADM)"
if curl -s "$API/roles/permisos" -H "$(H $ADM)" | grep -q '"clave":"web.acceso"'; then pass=$((pass+1)); echo "  ✅ El catálogo de permisos sigue mostrando sus claves"; else fail=$((fail+1)); echo "  ❌ El catálogo de permisos perdió sus claves"; fi

echo "── Recuperación de clave con OTP (flujo de la app y la web)"
# Se inserta un OTP conocido directamente (en local no hay servidor de correo).
HASH=$(node -e "console.log(require('bcrypt').hashSync('12345',10))")
$MONGO --eval "db.otps.insertOne({email:'$SEED_CLIENTE_EMAIL',hashedCode:'$HASH',active:true,used:false,expiresAt:new Date(Date.now()+300000),createdAt:new Date()})" >/dev/null
check "POST /otps/verify con código correcto"                  "200|201" -X POST "$API/otps/verify" -H "$J" -d "{\"email\":\"$SEED_CLIENTE_EMAIL\",\"code\":\"12345\"}"
check "PATCH /clientes/reset tras verificar"                   200 -X PATCH "$API/clientes/reset" -H "$J" -d "{\"email\":\"$SEED_CLIENTE_EMAIL\",\"password\":\"$SEED_CLIENTE_PASSWORD\"}"
check "PATCH /clientes/reset por segunda vez (un solo uso)"    403 -X PATCH "$API/clientes/reset" -H "$J" -d "{\"email\":\"$SEED_CLIENTE_EMAIL\",\"password\":\"Otra-Clave-99!\"}"
check "Login cliente con su clave tras el reset"               200 -X POST "$API/auth/login/cliente" -H "$J" -d "{\"correo\":\"$SEED_CLIENTE_EMAIL\",\"clave\":\"$SEED_CLIENTE_PASSWORD\"}"
RUN=$RANDOM$RANDOM
G=$(curl -s -X POST "$API/otps/generate" -H "$J" -d "{\"email\":\"gen-$RUN@enjoy.local\"}")
if echo "$G" | grep -q '"otp"'; then fail=$((fail+1)); echo "  ❌ /otps/generate devuelve el código"; else pass=$((pass+1)); echo "  ✅ /otps/generate ya no devuelve el código"; fi

echo "── Fuerza bruta del OTP"
BF="bf-$RUN@enjoy.local"
$MONGO --eval "db.otps.insertOne({email:'$BF',hashedCode:'$HASH',active:true,used:false,intentos:0,expiresAt:new Date(Date.now()+300000),createdAt:new Date()})" >/dev/null
for i in 1 2 3 4 5; do curl -s -o /dev/null -X POST "$API/otps/verify" -H "$J" -d "{\"email\":\"$BF\",\"code\":\"0000$i\"}"; done
check "Código correcto tras 5 intentos fallidos (anulado)"      "400|404" -X POST "$API/otps/verify" -H "$J" -d "{\"email\":\"$BF\",\"code\":\"12345\"}"
check "Código no numérico no rompe el servidor"                 400 -X POST "$API/otps/verify" -H "$J" -d "{\"email\":\"$BF\"}"
RL="rl-$RUN@enjoy.local"
for i in 1 2 3 4 5; do curl -s -o /dev/null -X POST "$API/otps/generate" -H "$J" -d "{\"email\":\"$RL\"}"; done
check "6.º /otps/generate a la misma cuenta en 15 min"          429 -X POST "$API/otps/generate" -H "$J" -d "{\"email\":\"$RL\"}"
check "…aunque cambie X-Forwarded-For"                          429 -X POST "$API/otps/generate" -H "$J" -H "X-Forwarded-For: 9.9.9.$((RANDOM%250))" -d "{\"email\":\"$RL\"}"

echo "── Alta y edición de usuarios (ámbito)"
LOCAL_ID=$($MONGO --eval 'db.usuarios.findOne({rol:"admin-local"})._id.toString()')
NUEVO="staff-$RUN@enjoy.local"
check "Admin local crea personal pidiendo rol admin"            "200|201" -X POST "$API/usuarios" -H "$(H $LOC)" -H "$J" -d "{\"nombre\":\"Staff $RUN\",\"email\":\"$NUEVO\",\"identificacion\":\"1710034065\",\"clave\":\"Clave-Segura-1!\",\"rol\":\"admin\"}"
R=$($MONGO --eval "const u=db.usuarios.findOne({email:'$NUEVO'}); u ? u.rol+'|'+String(u.usuarioCreacion) : 'no-creado'")
if [[ $R == "staff|$LOCAL_ID" ]]; then pass=$((pass+1)); echo "  ✅ …queda como staff de SU local"; else fail=$((fail+1)); echo "  ❌ …quedó como: $R"; fi
check "Cliente crea staff en un local (users-local)"            403 -X POST "$API/usuarios/users-local/$LOCAL_ID" -H "$(H $CLI)" -H "$J" -d "{\"nombre\":\"x\",\"email\":\"x-$RUN@enjoy.local\",\"identificacion\":\"1710034065\",\"clave\":\"Clave-Segura-1!\"}"
check "Admin local edita al administrador"                      403 -X PATCH "$API/usuarios/$ADMIN_ID" -H "$(H $LOC)" -H "$J" -d '{"nombre":"Hackeado"}'
check "Admin local se pone rol admin a sí mismo"                "200|201" -X PATCH "$API/usuarios/$LOCAL_ID" -H "$(H $LOC)" -H "$J" -d '{"rol":"admin"}'
R=$($MONGO --eval "db.usuarios.findOne({_id:ObjectId('$LOCAL_ID')}).rol")
if [[ $R == "admin-local" ]]; then pass=$((pass+1)); echo "  ✅ …su rol sigue siendo admin-local"; else fail=$((fail+1)); echo "  ❌ …su rol ahora es: $R"; fi
check "Admin local ve el personal de OTRO local"                403 "$API/usuarios/users-local/$ADMIN_ID" -H "$(H $LOC)"

echo "── Configuración pública (lista blanca)"
check "GET /configuracion/solicitud_notif_emails"               403 "$API/configuracion/solicitud_notif_emails"
check "GET /configuracion/contrato_enjoy_ruc"                   403 "$API/configuracion/contrato_enjoy_ruc"
check "GET /configuracion/whatsapp_numero (pública)"            "200|404" "$API/configuracion/whatsapp_numero"

echo "── Solicitudes de cuponera de un cliente"
CLI_ID=$($MONGO --eval "db.clientes.findOne({email:'$SEED_CLIENTE_EMAIL'})._id.toString()")
OTRO_ID=$($MONGO --eval "(db.clientes.findOne({email:{\$ne:'$SEED_CLIENTE_EMAIL'}})||{_id:new ObjectId()})._id.toString()")
check "GET solicitudes de un cliente sin sesión"                401 "$API/solicitudes-cuponera/cliente/$CLI_ID"
check "Cliente ve SUS solicitudes"                              200 "$API/solicitudes-cuponera/cliente/$CLI_ID" -H "$(H $CLI)"
check "Cliente ve solicitudes de OTRO cliente"                  403 "$API/solicitudes-cuponera/cliente/$OTRO_ID" -H "$(H $CLI)"
check "Admin local ve solicitudes de un cliente"                403 "$API/solicitudes-cuponera/cliente/$CLI_ID" -H "$(H $LOC)"
check "Admin ve solicitudes de un cliente"                      200 "$API/solicitudes-cuponera/cliente/$CLI_ID" -H "$(H $ADM)"
check "Crear solicitud sin sesión"                              401 -X POST "$API/solicitudes-cuponera" -H "$J" -d '{}'

$MONGO --eval "db.versioncuponeras.deleteMany({nombre:/HACK/}); db.rols.deleteMany({slug:'x'}); db.usuarios.deleteMany({email:/^(staff|x)-$RUN@/}); db.otps.deleteMany({email:/-$RUN@enjoy.local/})" >/dev/null
echo; echo "Resultado: $pass OK, $fail fallos"
exit $fail
