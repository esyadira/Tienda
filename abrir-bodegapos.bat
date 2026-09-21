@echo off
rem Abre BodegaPOS con impresion directa: sin dialogo y sin "Guardar como PDF".
rem IMPORTANTE: cierra TODAS las ventanas de Brave antes de usar este acceso directo.
rem (si ya hay un Brave abierto, ignora la opcion --kiosk-printing)

set "URL=http://localhost:3000/index.html"
set "NAV="

if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" set "NAV=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe" set "NAV=%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not defined NAV if exist "%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe" set "NAV=%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not defined NAV if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

if not defined NAV (
  echo No se encontro Brave, Chrome ni Edge en las rutas normales.
  echo Crea un acceso directo a tu navegador y agrega al final del destino:  --kiosk-printing
  pause
  exit /b 1
)

start "" "%NAV%" --kiosk-printing "%URL%"
