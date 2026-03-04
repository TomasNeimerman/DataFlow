!macro customInit
  SetShellVarContext all
!macroend

!macro customInstall
  DetailPrint "Compilando SDKWrapper para integración Bejerman ERP..."

  StrCpy $R0 "C:\Bejerman\Instalación\Tester"
  StrCpy $R1 "$INSTDIR\resources\app\electron\bejermanSDK\wrapper"

  ${If} ${FileExists} "$R0\SB.NET.eFlex.SDKLib.dll"
    ; Copiar fuentes al SDK folder
    CopyFiles /SILENT "$R1\SDKWrapper.cs" "$R0\SDKWrapper.cs"
    CopyFiles /SILENT "$R1\SDKWrapper.exe.config" "$R0\SDKWrapper.exe.config"

    ; Generar bat que referencia todos los .dll del folder y compila
    FileOpen $R3 "$R0\_compilar_auto.bat" w
    FileWrite $R3 "@echo off$\r$\n"
    FileWrite $R3 "setlocal enabledelayedexpansion$\r$\n"
    FileWrite $R3 "set REFS=$\r$\n"
    FileWrite $R3 "for %%f in (*.dll) do set REFS=!REFS! /reference:%%f$\r$\n"
    FileWrite $R3 '"$WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe" /target:exe /out:SDKWrapper.exe /platform:x86 !REFS! SDKWrapper.cs$\r$\n'
    FileClose $R3

    nsExec::ExecToLog '"$WINDIR\System32\cmd.exe" /c cd /d "$R0" && "$R0\_compilar_auto.bat"'
    Pop $R2

    Delete "$R0\_compilar_auto.bat"

    ${If} $R2 == "0"
      DetailPrint "SDKWrapper compilado exitosamente."
    ${Else}
      DetailPrint "SDKWrapper no se pudo compilar (codigo $R2). Revise .NET Framework 4.x."
    ${EndIf}
  ${Else}
    DetailPrint "SDK de Bejerman no encontrado en $R0. SDKWrapper no compilado."
  ${EndIf}
!macroend

!macro customUnInstall
  DetailPrint "Eliminando archivos de configuración..."
  DeleteRegKey HKLM "Software\\BejermanErpUpdater"
  Delete "$APPDATA\\BejermanErpUpdater\\*.*"
  RMDir /r "$APPDATA\\BejermanErpUpdater"
!macroend
