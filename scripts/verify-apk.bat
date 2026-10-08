@echo off
set JAVA=C:\Users\Admin\AppData\Local\Android\jdk17\jdk-17.0.20.1+1\bin\java.exe
set BT=C:\Users\Admin\AppData\Local\Android\Sdk\build-tools\36.1.0
cd /d "%~dp0..\android"
"%JAVA%" -jar "%BT%\lib\apksigner.jar" verify --print-certs app-release-signed.apk | findstr SHA-256
"%BT%\aapt.exe" dump badging app-release-signed.apk | findstr "package: application-label"
