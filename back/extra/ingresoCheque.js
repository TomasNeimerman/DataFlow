document.addEventListener('DOMContentLoaded', () => {
    const empresasSelect = document.getElementById('empresas');
    const loadButton = document.getElementById('loadButton');
    const saveButton = document.getElementById('saveButton');
    const empresaStatus = document.getElementById('empresaStatus');
    const fileInput = document.getElementById('fileInput');
    const fileStatus = document.getElementById('fileStatus');
    

    let chequesData = null;
    let isProcessing = false;

    // Cargar empresas al inicio
    window.api.getEmpresas().then((empresas) => {
        empresas.forEach(empresa => {
            const option = document.createElement('option');
            option.value = empresa.id;
            option.textContent = empresa.nombre;
            empresasSelect.appendChild(option);
        });
    });


    empresasSelect.addEventListener('change', async () => {
        const selectedEmpresa = empresasSelect.value;
        if (!selectedEmpresa) {
            empresaStatus.textContent = "Seleccione una empresa.";
            return;
        }
    
        try {
            const tableExists = await window.api.checkTableExists(selectedEmpresa);
            
            if (tableExists) {
                console.log(`La tabla existe para la empresa ${selectedEmpresa}`);
                empresaStatus.textContent = `Existe la base de datos ${selectedEmpresa}`
            } else {
                console.log(`La tabla no existe para la empresa ${selectedEmpresa}`);
                empresaStatus.textContent = `No existe la base de datos ${selectedEmpresa}`
            }
        } catch (error) {
            console.error('Error al verificar la tabla:', error);
        }
        
    });
    

    // Manejar el click en el botón de cargar Excel

    // Manejar carga de archivo

    loadButton.addEventListener('click', async () => {
        const empresaSeleccionada = empresasSelect.value;
       
        if (!empresaSeleccionada) {
            alert('Por favor, seleccione una empresa antes de cargar el archivo');
            return;
        }
       
        try {
            // Llamar a la función loadCheques del main process
            chequesData = await window.api.loadCheques(); 
            if (!chequesData) {
                fileStatus.textContent = 'No se seleccionó ningún archivo o el archivo está vacío';
                return;
            }
            // Extraer los IDs de cheques
            const chequeIds = chequesData.map(cheque => cheque.idCheque);      
            const verificationResults = await window.api.verifyCheques(chequeIds, empresaSeleccionada);
            const chequesExistentes = verificationResults.filter(r => r.exists).length;
            const chequesNoExistentes = verificationResults.filter(r => !r.exists).length;
            let mensaje = `Archivo cargado exitosamente.\n Verificación completada:\n ${chequesExistentes} cheques encontrados //// ${chequesNoExistentes} cheques no encontrados`;
            if (chequesNoExistentes > 0) {
                const chequesNoEncontrados = verificationResults
                    .filter(r => !r.exists)
                    .map(r => r.idCheque)
                    .join(', ');
                mensaje += `\nCheques no encontrados: ${chequesNoEncontrados}`;
            }
            
            fileStatus.textContent = mensaje;
            saveButton.disabled = chequesExistentes === 0;
            
        } catch (error) {
            console.error('Error al cargar el archivo:', error);
            fileStatus.textContent = `Error al cargar el archivo: ${error.message}`;
            saveButton.disabled = true;
        }
    });

    // Manejar el guardado de cheques
    saveButton.addEventListener('click', async () => {
        if (isProcessing || !chequesData) return;
        
        isProcessing = true;
        saveButton.disabled = true;
        fileStatus.textContent = 'Actualizando cheques...';
        
        try {
            const result = await window.api.updateCheques(chequesData, empresasSelect.value);
            if (result.success) {

                fileStatus.textContent = `Se actualizaron ${result.procesadosOK} cheques exitosamente.`;
                if (result.conError > 0) {
                    fileStatus.textContent += `\n${result.conError} cheques no pudieron ser procesados.`;
                }

                alert(`Se actualizaron ${result.procesadosOK} cheques exitosamente. ${result.conError} no pudieron ser procesados.<br>`);
                

            } else {
                fileStatus.textContent = `Error: ${result.error}`;
            }
        } catch (error) {
            console.error('Error al actualizar cheques:', error);
            fileStatus.textContent = `Error: ${error.message}`;
        } finally {
            isProcessing = false;
            saveButton.disabled = !chequesData;
        }
    });
});