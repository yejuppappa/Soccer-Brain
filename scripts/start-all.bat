@echo off
echo ========================================
echo    Soccer Brain V9 - 서버 시작
echo ========================================
echo.

:: ML 서버 시작 (새 창에서)
echo [1/2] ML 서버 시작 중...
start "ML Server" cmd /k "cd /d %~dp0..\scripts && python predict_server.py"

:: 3초 대기 (ML 서버 로딩)
echo 잠시 대기 중... (ML 서버 로딩)
timeout /t 3 /nobreak > nul

:: Express 서버 시작
echo [2/2] Express 서버 시작 중...
cd /d %~dp0..
npm run dev

pause
