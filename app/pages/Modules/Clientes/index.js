"use client";

import Clientes from "../../components/ClientesContainer";
import styles from "./styles.module.css";

export default function ClientesPage() {
  return (
    <div className={styles.body}>
      <Clientes />
    </div>
  );
}
