// jwtService.js
const jwt = require('jsonwebtoken');

// ¡IMPORTANTE! Reemplaza 'tu_secreto_seguro' con una clave secreta real y segura
const JWT_SECRET = 'CONEERP';

function generarToken(user) {
  // Aquí puedes incluir la información del usuario que quieres guardar en el token
  const payload = {
    userId: user.ID, // Reemplaza 'ID' con el identificador único de tu usuario
    usuario: user.Usuario,
    // ... otros datos del usuario que quieras incluir
  };

  // Genera el token con una duración (opcional)
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '3h' }); 
  return token;
}

module.exports = { generarToken };