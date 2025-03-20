const jwt = require('jsonwebtoken');

const SECRET_KEY = 'CONE'; // Cambia esto por una clave fuerte

function generarToken(usuario) {
    const payload = {
        id: usuario.Id,
        usuario: usuario.Usuario,
        nombre: usuario.Nombre,
        apellido: usuario.Apellido,
    };

    return jwt.sign(payload, SECRET_KEY, { expiresIn: '2h' });
}

function verificarToken(token) {
    try {
        return jwt.verify(token, SECRET_KEY);
    } catch (error) {
        return null;
    }
}

module.exports = { generarToken, verificarToken };
