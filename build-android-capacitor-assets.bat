@echo off
setlocal

cd /d "%~dp0"
set "npm_config_cache=%CD%\.npm-cache"

echo.
echo === CANS Studio: build Android + Capacitor assets ===
echo.

if not exist "node_modules\.bin\cap.cmd" (
  echo Installazione dipendenze npm...
  call npm.cmd install --cache "%npm_config_cache%"
  if errorlevel 1 goto :error
)

echo Build web...
call npm.cmd run build
if errorlevel 1 goto :error

echo Generazione asset Capacitor Android...
call npx.cmd --cache "%npm_config_cache%" --yes @capacitor/assets generate --assetPath resources --android
if errorlevel 1 goto :error

echo Abilitazione themed icon Android / Monet...
call node scripts\ensure-android-themed-icon.mjs
if errorlevel 1 goto :error

echo Sincronizzazione Android...
call node_modules\.bin\cap.cmd sync android
if errorlevel 1 goto :error

echo.
echo Build completata. Apri la cartella android in Android Studio.
echo.
pause
exit /b 0

:error
echo.
echo Build interrotta: controlla il messaggio di errore qui sopra.
echo.
pause
exit /b 1
