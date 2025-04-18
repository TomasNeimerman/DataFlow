"use client";
import { useEffect, useState } from 'react';
import Image from 'next/image';
import styles from './styles.module.css';
import logo from '../../../public/logo_cone.png';
import ModuleForm from '@/app/components/ModulesForm';

export default function Modules() {
  const [modulo, setModulo] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mod = params.get("modulo");
    if (mod) {
      setModulo(mod);
      localStorage.setItem("moduleName", mod); // Opcional: solo si querés persistirlo
    }
  }, []);

  return (
    <div className={styles.body}>
      <Image alt='CONE ERP' className={styles.img} src={logo} />
      <ModuleForm module={modulo} />
    </div>
  );
}
