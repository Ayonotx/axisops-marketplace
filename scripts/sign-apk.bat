@echo off
REM Signs the TWA APK (avoids bubblewrap's unquoted JAVA_HOME bug on Windows).
REM Reads the keystore password from android\KEYSTORE-SECRET.txt at runtime.
setlocal enabledelayedexpansion
set JAVA=C:\Users\Admin\AppData\Local\Android\jdk17\jdk-17.0.20.1+1\bin\java.exe
set APKSIGNER=C:\Users\Admin\AppData\Local\Android\Sdk\build-tools\36.1.0\lib\apksigner.jar
cd /d "%~dp0..\android"
for /f "tokens=3" %%p in ('findstr /c:"Store password" KEYSTORE-SECRET.txt') do set PW=%%p
"%JAVA%" -jar "%APKSIGNER%" sign --ks axisops-upload.jks --ks-key-alias axisops --ks-pass pass:!PW! --key-pass pass:!PW! --out app-release-signed.apk app-release-unsigned-aligned.apk
if errorlevel 1 (echo SIGN_FAILED & exit /b 1)
echo SIGN_OK
