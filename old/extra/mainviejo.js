ipcMain.handle('check-table-exists', async (event, empresaId) => {
    try {
        const pool = await connectToDatabase(empresaId);

        // Aquí verifica si existe la tabla en la base de datos
        const query = `
            SELECT COUNT(*) AS count 
            FROM sys.databases 
            WHERE name = '${empresaId}'`;

        const result = await pool.request().query(query);
        return result.recordset[0].count > 0;
    } catch (error) {
        console.error(`Error al verificar tabla para la empresa ${empresaId}:`, error);
        throw error;
    }
});



// En tu archivo main.js o donde manejes los eventos del proceso principal

ipcMain.handle('load-cheques', async (event) => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        const filePath = result.filePaths[0];
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const cheques = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        logger.info('Cargando archivo de cheques:', filePath);

        // Validar estructura del archivo
        if (cheques.length === 0) {
            logger.error('El archivo está vacío');
            throw new Error('El archivo está vacío');
        }

        // Verificar las columnas necesarias
        if (!cheques[0].hasOwnProperty('ID Cheque') || !cheques[0].hasOwnProperty('Nro Definitivo')) {
            logger.error('El archivo no tiene el formato esperado');
            throw new Error('El archivo debe contener las columnas "ID Cheque" y "Nro Definitivo"');
        }
        
        // Mapear los datos sin duplicación
        const mappedCheques = cheques.map(row => ({
            codEmpresa: row[0] || '',
            idCheque: parseInt(row[2], 10),
            nroDefinitivo: parseInt(row[9])
        }));

        // Validar que nroDefinitivo no tenga más de 8 caracteres
        const invalidCheques = mappedCheques.filter(cheque => cheque.nroDefinitivo.toString().length > 8);
        if (invalidCheques.length > 8) {
            logger.error('El Número Definitivo excede la cantidad máxima permitida');
            throw new Error('El Número Definitivo excede la cantidad máxima permitida');
        }else if(invalidCheques.length<0){
            logger.error('No se informa Número Definitivo para el Cheque');
            throw new Error('No se informa Número Definitivo para el Cheque');
        }

        const invalidCodEmpresa = mappedCheques.filter(cheque => cheque.codEmpresa.toString().length > 8);
        if (invalidCodEmpresa.length > 8) {
            logger.error('El código de empresa excede la cantidad máxima permitida (8)');
            throw new Error('El código de empresa excede la cantidad máxima permitida (8)');
        }

        logger.info(`Se cargaron ${mappedCheques.length} cheques del archivo`);
        return mappedCheques;

    } catch (error) {
        logger.error('Error al cargar el archivo de cheques:', error);
        throw error;
    }
});

ipcMain.handle('verify-cheques', async (event, chequeIds, empresaId) => {
    let connection;
    try {
        
        logger.info(`conectando a ${empresaId} para verificar`)
        const results = [];
        for (const idCheque of chequeIds) {
            const result = await connection.request()
                .input('empresaId', sql.VarChar, empresaId) // Corresponde a chpemp_Codigo
                .input('idCheque', sql.Int, idCheque) // Corresponde a chp_ID
                .query(`
                    SELECT * 
                    FROM dbo.ChequesP 
                    WHERE chpemp_Codigo = @empresaId 
                    AND chp_ID = @idCheque
                `);
            
            // Verifica si el cheque fue encontrado
            results.push(result.recordset.length > 0);
        }
        return results;
    } catch (error) {
        console.error(`Error al verificar el cheque: ${error.message}`);
        throw new Error(`No existe el Cheque (${chequeIds}) en la empresa informada`);
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});


ipcMain.handle('update-cheques', async (event, cheques, empresaId) => {
    let connection;
    let chequesOK = 0 ;
    let chequesNoProcesados = 0;
    let listaNoProcesados = [];
    try {

        logger.info(`Iniciando actualización de cheques para la empresa: ${empresaId}`);
        connection = await connectToDatabase(empresaId);

        for (const {codEmpresa, idCheque, nroDefinitivo } of cheques) {
            if (codEmpresa != empresaId){
                listaNoProcesados.push({'idCheque':idCheque,'descripcion':'La empresa seleccionada no se corresponde con la del Excel'});
                chequesNoProcesados ++;
                logger.error(`El codigo de empresa del excel: ${codEmpresa}, no se corresponde con la seleccionada: ${empresaId}`);
                return
            }
            if (nroDefinitivo == null || nroDefinitivo == ''){
                listaNoProcesados.push({'idCheque':idCheque,'descripcion':'Nro Definitivo en excel esta vacio'});
                chequesNoProcesados ++;
                logger.error(`El numero que quiere actualizar esta vacio`);                
                return
            }
            logger.info(`Actualizando cheque ID: ${idCheque}, Nro Definitivo: ${nroDefinitivo}`);
            try {
                const result = await connection.request()
                    .input('nuevoValor', sql.NVarChar(50), nroDefinitivo)  // Manejo de int
                    .input('nroCheque', sql.Int, idCheque)        // Manejo de int
                    .query(`
                        USE ${empresaId};
                        UPDATE dbo.ChequesP
                        SET chp_NroCheq = @nuevoValor
                        WHERE chp_ID = @nroCheque
                    `);
                
                // Verificar si la consulta no afectó ninguna fila
                if (result.rowsAffected[0] === 0) {
                    listaNoProcesados.push({'idCheque':idCheque,'descripcion':'Cheque no pudo ser actualizado, verifique que exista en la base de datos.'});
                    chequesNoProcesados++;
                    const notFoundMsg = `Cheque con ID ${idCheque} no encontrado.`;
                    logger.info(notFoundMsg);
                } else {
                    chequesOK++;
                    logger.info(`Cheque ${idCheque} actualizado correctamente.`);
                }
            } catch (queryError) {
                chequesNoProcesados++;
                const queryErrorMsg = `Error en la consulta SQL al actualizar cheque ID ${idCheque}: ${queryError.message}`;
                listaNoProcesados.push({'idCheque':idCheque,'descripcion':`${queryError.message}`});
                logger.error(queryErrorMsg);
                //throw new Error(queryErrorMsg); // Relanzar el error para manejarlo fuera del bloque try
            }
        }

        logger.info(`Actualización de cheques completada para la empresa: ${empresaId}`);
        return { success: true, procesadosOK: chequesOK , conError:chequesNoProcesados,listaNoProcesados:listaNoProcesados };
    } catch (error) {
        const errorMsg = `Error en la actualización de cheques: ${error.message}`;
        logger.error(errorMsg); // Detalle del error en consola
        return { success: false, error: errorMsg,listaNoProcesados:listaNoProcesados }; // Devolver el error para el frontend
    } finally {
        if (connection) {
            try {
                await connection.close();
                logger.info('Conexión a la base de datos cerrada');
            } catch (closeError) {
                logger.error(`Error al cerrar la conexión: ${closeError.message}`);
            }
        }
    }
});
