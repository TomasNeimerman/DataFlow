// app/Precios/page.js
"use client";

import CuadroPrecios from '../../components/CuadroPrecios';
import { useState, useEffect } from 'react';
import pageStyles from './styles.module.css';

export default function Precios() {
  const [precios, setPrecios] = useState([]);
  useEffect(() => {
    const fetchData = async () => {
        try {
            const response = await window.api.getPrecios();
            if (response.success) {
                setPrecios(response.precios);
            } else {
                console.error('Error al obtener precios:', response.message);
            }
        } catch (error) {
            console.error('Error al conectar con el servidor:', error);
        }
      }
      fetchData();
  }, []);
  console.log(precios);
  return (
    <div className={pageStyles.body}>
        <CuadroPrecios precios = {precios} />

    </div>
  );
}
