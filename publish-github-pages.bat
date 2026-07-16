@echo off
setlocal
cd /d "%~dp0"

set "OWNER=StefanoNevePsy"
set "REPO=cans-studio"

echo.
echo CANS Studio - pubblicazione GitHub Pages
echo ========================================
echo.

where gh >nul 2>&1
if errorlevel 1 (
  where winget >nul 2>&1
  if errorlevel 1 (
    echo GitHub CLI non e installato e winget non e disponibile.
    echo Installa GitHub CLI da https://cli.github.com/ e riapri questo file.
    pause
    exit /b 1
  )

  echo Installazione di GitHub CLI...
  winget install --id GitHub.cli --exact --source winget
  if errorlevel 1 (
    echo Installazione non riuscita.
    pause
    exit /b 1
  )

  set "PATH=%PATH%;C:\Program Files\GitHub CLI"
)

gh auth status >nul 2>&1
if errorlevel 1 (
  echo Accesso a GitHub...
  gh auth login --web --git-protocol https
  if errorlevel 1 (
    echo Accesso non completato.
    pause
    exit /b 1
  )
)

if not exist ".git\HEAD" (
  if exist ".git" (
    dir /b ".git" 2>nul | findstr . >nul
    if not errorlevel 1 (
      echo La cartella .git esiste ma non contiene un repository valido.
      echo Rimuovila manualmente solo dopo aver verificato che sia vuota.
      pause
      exit /b 1
    )
    rmdir ".git"
  )

  git init -b main
)

git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Publish CANS Studio"
  if errorlevel 1 (
    echo Commit non riuscito.
    pause
    exit /b 1
  )
)

gh repo view "%OWNER%/%REPO%" >nul 2>&1
if errorlevel 1 (
  echo Creazione del repository pubblico %OWNER%/%REPO%...
  gh repo create "%OWNER%/%REPO%" --public --description "Scoring collaborativo CANS 0-5 e 5-17+" --source . --remote origin --push
  if errorlevel 1 (
    echo Creazione o push non riusciti.
    pause
    exit /b 1
  )
) else (
  git remote get-url origin >nul 2>&1
  if errorlevel 1 git remote add origin "https://github.com/%OWNER%/%REPO%.git"
  git push -u origin main
  if errorlevel 1 (
    echo Push non riuscito.
    pause
    exit /b 1
  )
)

gh api --method POST "repos/%OWNER%/%REPO%/pages" -f build_type=workflow >nul 2>&1

echo.
echo Pubblicazione completata.
echo Repository: https://github.com/%OWNER%/%REPO%
echo GitHub Pages: https://%OWNER%.github.io/%REPO%/
echo.
echo La prima build Pages puo richiedere alcuni minuti.
pause
