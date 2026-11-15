@echo off
rem Opens the RingLink website on this PC (http://127.0.0.1:5191). Close this window to stop it.
cd /d "%~dp0"
start "" http://127.0.0.1:5191/
python -m http.server 5191 --bind 127.0.0.1
