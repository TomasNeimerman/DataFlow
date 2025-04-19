"use client";
import { useEffect, useState } from 'react';
import Image from 'next/image';
import styles from './styles.module.css';
import logo from '../../../public/logo_cone.png';
import ModuleForm from '@/app/components/ModulesForm';

export default function Modules() {
 
  return (
    <div className={styles.body}>
      <Image alt='CONE ERP' className={styles.img} src={logo} />
      <ModuleForm   nombreModulo={"Cheques"}/>
    </div>
  );
}
