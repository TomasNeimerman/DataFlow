// pages/clientes/index.jsx
import Clientes from "../../components/ClientesContainer";
import styles from "./styles.module.css"

export default function ClientesPage() {
  return (
    <div className={styles.body}>
    <Clientes
      clientes={[
        { id: 1, empresa: "ACME", codigo: "CL0001", nombre: "Juan Pérez", cuit: "20-12345678-9", estado: "ACTIVO", vendedor: "001", lista: "015", ultimaMod: "2025-10-01" },
        { id: 2, empresa: "ACME", codigo: "CL0002", nombre: "María López", cuit: "27-87654321-0", estado: "INACTIVO", vendedor: "002", lista: "001", ultimaMod: "2025-10-10" },
      ]}
      opcionesEstado={[{ value: "ACTIVO", label: "Activo" }, { value: "INACTIVO", label: "Inactivo" }]}
      opcionesCategoria={[{ value: "A", label: "A" }, { value: "B", label: "B" }]}
      vendedores={[{ value: "001", label: "001 - Norte" }, { value: "002", label: "002 - Sur" }]}
      // ...callbacks reales cuando conectes IPC/SQL
    />
    </div>
  );
}
