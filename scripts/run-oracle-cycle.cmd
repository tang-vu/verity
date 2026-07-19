@echo off
REM Scheduled entry point for the oracle cycle (see run-oracle-cycle.ts).
REM Task Scheduler starts tasks in system32, so resolve the repo from this file.
REM Output is appended to loop-output\cycle.log, which is gitignored.
chcp 65001 >nul
cd /d "%~dp0.."
echo. >> loop-output\cycle.log
echo ==== cycle started %DATE% %TIME% ==== >> loop-output\cycle.log
call npm run cycle >> loop-output\cycle.log 2>&1
echo ==== cycle exited with %ERRORLEVEL% ==== >> loop-output\cycle.log
