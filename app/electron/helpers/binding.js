// electron/helpers/binding.js
function bindUserLocally(store, usuario) {
  const boundUser = store && store.get('boundUser');
  if (!boundUser) {
    if (store) store.set('boundUser', usuario);
    return { ok: true };
  }
  if (boundUser !== usuario) {
    return {
      ok: false,
      message: `Esta instalación ya está vinculada al usuario "${boundUser}". Pedí al admin un reseteo si querés cambiar.`
    };
  }
  return { ok: true };
}

module.exports = { bindUserLocally };
