!macro customInit
  SetShellVarContext all
!macroend

!macro customInstall
  DetailPrint "Instalando Bejerman ERP Updater..."
!macroend

!macro customUnInstall
  DetailPrint "Eliminando archivos de configuración..."
  DeleteRegKey HKLM "Software\\BejermanErpUpdater"
  Delete "$APPDATA\\BejermanErpUpdater\\*.*"
  RMDir /r "$APPDATA\\BejermanErpUpdater"
!macroend
