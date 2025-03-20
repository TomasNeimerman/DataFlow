function login() {
    const usuario = document.getElementById('usuario').value;
    const contraseña = document.getElementById('contraseña').value;
    window.api.login(usuario, contraseña);
}

window.api.onLoginSuccess((data) => {
    const token = data;
    localStorage.setItem('jwtToken', token);
    window.location.href = 'index.html';
 
});

window.api.onLoginFailed((message) => {
    document.getElementById('error').innerText = message;
});

