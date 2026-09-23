; BodegaPOS — instalador para Windows (NSIS). Se compila con:  makensis -DORIGEN=<carpeta> -DSALIDA=<Setup.exe> instalador.nsi
Unicode true
!include "MUI2.nsh"

!define NOMBRE  "BodegaPOS"
!define VERSION "1.0.0"
!define EXE     "BodegaPOS.exe"
!define UNINST  "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NOMBRE}"

Name "${NOMBRE}"
OutFile "${SALIDA}"
; Instalación por usuario: no pide permisos de administrador ni contraseña
InstallDir "$LOCALAPPDATA\Programs\${NOMBRE}"
InstallDirRegKey HKCU "Software\${NOMBRE}" "Dir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "${NOMBRE} ${VERSION}"

!define MUI_ICON   "icono.ico"
!define MUI_UNICON "icono.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Instalar BodegaPOS"
!define MUI_WELCOMEPAGE_TEXT "Este asistente instalará BodegaPOS, tu sistema de punto de venta, en este equipo.$\r$\n$\r$\nFunciona sin internet. Tus productos, ventas y clientes se guardan en esta computadora y no se borran al actualizar ni al desinstalar el programa.$\r$\n$\r$\nHaz clic en Siguiente para continuar."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir BodegaPOS ahora"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

Section "Instalar"
  ; Si BodegaPOS está abierto, se cierra para poder reemplazar los archivos (los datos no se tocan)
  nsExec::Exec 'taskkill /F /IM ${EXE}'
  Sleep 800
  ; Quita la versión anterior de la app (evita archivos viejos sueltos al actualizar)
  RMDir /r "$INSTDIR\resources\app"

  SetOutPath "$INSTDIR"
  File /r "${ORIGEN}\*.*"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"

  CreateShortCut "$DESKTOP\${NOMBRE}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\resources\app\icono.ico" 0
  CreateDirectory "$SMPROGRAMS\${NOMBRE}"
  CreateShortCut "$SMPROGRAMS\${NOMBRE}\${NOMBRE}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\resources\app\icono.ico" 0
  CreateShortCut "$SMPROGRAMS\${NOMBRE}\Desinstalar ${NOMBRE}.lnk" "$INSTDIR\Desinstalar.exe"

  WriteRegStr HKCU "Software\${NOMBRE}" "Dir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST}" "DisplayName" "${NOMBRE}"
  WriteRegStr HKCU "${UNINST}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST}" "Publisher" "${NOMBRE}"
  WriteRegStr HKCU "${UNINST}" "DisplayIcon" "$INSTDIR\resources\app\icono.ico"
  WriteRegStr HKCU "${UNINST}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST}" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegDWORD HKCU "${UNINST}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM ${EXE}'
  Sleep 800
  Delete "$DESKTOP\${NOMBRE}.lnk"
  RMDir /r "$SMPROGRAMS\${NOMBRE}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINST}"
  DeleteRegKey HKCU "Software\${NOMBRE}"
  ; Los datos del negocio (productos, ventas, clientes) están en %APPDATA%\BodegaPOS y NO se borran aquí.
SectionEnd
