@echo off
REM Signs the TWA AAB for Play upload. Reads password from KEYSTORE-SECRET.txt.
setlocal enabledelayedexpansion
cd /d "%~dp0..\android"
if not exist app-release.aab copy app\build\outputs\bundle\release\app-release.aab app-release.aab
for /f "tokens=3" %%p in ('findstr /c:"Store password" KEYSTORE-SECRET.txt') do set PW=%%p
jarsigner -keystore axisops-upload.jks -storepass !PW! -keypass !PW! app-release.aab axisops
if errorlevel 1 (echo AAB_SIGN_FAILED & exit /b 1)
echo AAB_SIGNED
