// En la versión de escritorio (protocolo app://) no hace falta: todo ya está dentro del programa
if ('serviceWorker' in navigator && location.protocol !== 'app:') {
  const registrarSW = () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registrado:', reg.scope))
      .catch(err => console.log('SW error:', err));
  };
  // Este script se carga de forma dinámica, cuando 'load' ya pudo haber ocurrido
  if (document.readyState === 'complete') registrarSW();
  else window.addEventListener('load', registrarSW);
}
