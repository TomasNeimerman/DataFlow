import styles from './styles.module.css'
const ModuleForm = () => {
    return (
        <div className={styles.container}>
        <h1 className={styles.title}>Actualizador de Cheques</h1>
        <select className={styles.select} id="empresas">
            <option value="">Seleccione una empresa</option>
        </select>
        <input type='file' className={styles.input} id="loadFile" accept=".xlsx, .xls"></input>
        <button className={styles.btn2} id="cancel" disabled>Cancelar</button>
        <button className={styles.btn2} id="verifyButton" disabled>Verificar</button>
        <button className={styles.btn} id="saveButton" disabled>Guardar</button>
        <p className={styles.error} id="fileStatus">No se ha cargado ningún archivo de cheques</p>
      </div>
    )
}
export default ModuleForm