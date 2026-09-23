#!/bin/bash
# Arma el instalador de Windows desde Linux (no hace falta Windows ni Wine).
# Requisitos: node/npm y makensis (apt install nsis).  Uso:  bash escritorio/construir.sh
set -e
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
TMP="${TMPDIR:-/tmp}/bodegapos-build"
SALIDA="${1:-$RAIZ/BodegaPOS-Setup.exe}"
ELECTRON_VERSION="${ELECTRON_VERSION:-44.4.3}"

rm -rf "$TMP" && mkdir -p "$TMP/electron" "$TMP/pkg"
# 1) Electron para Windows (64 bits)
( cd "$TMP/electron" && npm init -y >/dev/null && npm_config_platform=win32 npm_config_arch=x64 npm install "electron@$ELECTRON_VERSION" >/dev/null 2>&1 \
  && npm_config_platform=win32 npm_config_arch=x64 node node_modules/electron/install.js )
cp -r "$TMP/electron/node_modules/electron/dist/." "$TMP/pkg/"
mv "$TMP/pkg/electron.exe" "$TMP/pkg/BodegaPOS.exe"
rm -f "$TMP/pkg/resources/default_app.asar"
# solo idiomas necesarios (ahorra ~40 MB)
find "$TMP/pkg/locales" -name '*.pak' ! -name 'es.pak' ! -name 'es-419.pak' ! -name 'en-US.pak' -delete
# 2) La app: envoltorio + www/
APP="$TMP/pkg/resources/app"; mkdir -p "$APP/www"
cp "$RAIZ"/escritorio/{package.json,main.js,preload.js,prompt-preload.js,icono.ico} "$APP/"
cp -r "$RAIZ"/{index.html,manifest.json,sw.js,css,js,vistas,img,vendor} "$APP/www/"
# 3) Instalador
makensis -V2 -DORIGEN="$TMP/pkg" -DSALIDA="$SALIDA" "$RAIZ/escritorio/instalador.nsi"
ls -la "$SALIDA"
