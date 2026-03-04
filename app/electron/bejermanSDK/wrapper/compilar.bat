@echo off
REM ============================================================
REM  Compilar SDKWrapper.exe
REM
REM  USO:
REM    1. Copiar este archivo y SDKWrapper.cs a la carpeta donde
REM       estan las DLLs del SDK de Bejerman
REM    2. Ejecutar este .bat
REM    3. Se genera SDKWrapper.exe en la misma carpeta
REM
REM  REQUISITOS:
REM    - .NET Framework 4.6.1 instalado (incluye csc.exe)
REM    - DLLs del SDK en la misma carpeta:
REM        SB.NET.eFlex.SDKLib.dll
REM        SB.NET.eFlex.SDKLib.Comprobantes.dll
REM        SB.NET.eFlex.SDKLib.Tablas.dll (opcional)
REM        SB.NET.eFlex.SDKLib.Stock.dll (opcional)
REM ============================================================

echo.
echo === Compilando SDKWrapper.exe ===
echo.

REM Buscar csc.exe de .NET Framework 4.x (x86 - requerido por DLLs del SDK)
set CSC=
if exist "%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe" (
    set CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
) else (
    for /f "delims=" %%i in ('dir /b /s "%WINDIR%\Microsoft.NET\Framework\v4*\csc.exe" 2^>nul') do set CSC=%%i
)

if "%CSC%"=="" (
    echo ERROR: No se encontro csc.exe de .NET Framework 4.x
    echo Instale .NET Framework 4.6.1 o superior
    pause
    exit /b 1
)

echo Usando compilador: %CSC%
echo.

REM Verificar que las DLLs existan
if not exist "SB.NET.eFlex.SDKLib.dll" (
    echo ERROR: No se encontro SB.NET.eFlex.SDKLib.dll
    echo Copie este script a la carpeta donde estan las DLLs del SDK
    pause
    exit /b 1
)

if not exist "SB.NET.eFlex.SDKLib.Comprobantes.dll" (
    echo ERROR: No se encontro SB.NET.eFlex.SDKLib.Comprobantes.dll
    pause
    exit /b 1
)

REM Compilar (x86 obligatorio - las DLLs del SDK son 32-bit)
REM Referencia todos los .dll del folder para cubrir cualquier version del SDK
setlocal enabledelayedexpansion
set REFS=
for %%f in (*.dll) do set REFS=!REFS! /reference:%%f

"%CSC%" /target:exe /out:SDKWrapper.exe /platform:x86 !REFS! SDKWrapper.cs

if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: La compilacion fallo
    pause
    exit /b 1
)

echo.
echo === SDKWrapper.exe compilado exitosamente ===
echo.
echo Para probar:
echo   SDKWrapper.exe --empresa MODE --usuario ADMIN --pto-trabajo 1 --json-file recibo.json
echo.
pause
