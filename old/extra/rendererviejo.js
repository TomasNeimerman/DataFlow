let chequesData = null;

// Cuando se carga el archivo de cheques
window.api.onChequesLoaded((cheques) => {
    chequesData = cheques;
    document.getElementById('fileStatus').textContent = 'Archivo de cheques cargado';
});

document.getElementById('saveButton').addEventListener('click', async () => {
    if (!chequesData) {
        alert('No se ha cargado ningún archivo de cheques.');
        return;
    }

    const empresa = document.getElementById('empresas').value;
    if (!empresa) {
        alert('Debe seleccionar una empresa');
        return;
    }

    try {
        // Enviar datos al backend
        const result = await window.api.updateCheques(chequesData, empresa);
        if (result.success) {
            alert('Cheques actualizados exitosamente');
        } else {
            alert('Error al actualizar cheques');
        }
    } catch (error) {
        console.error('Error al actualizar cheques:', error);
        alert('Error al actualizar cheques. Por favor, intente nuevamente.');
    }
});
