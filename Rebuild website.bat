@echo off
rem Refreshes the website from the LED Ring v2 project: ring mesh, renders and the demo
rem control page (copied from the firmware's page.h). Run it after the CAD or firmware changes.
cd /d "%~dp0"
python tools\build_site.py
echo.
pause
