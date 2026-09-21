if ('serviceWorker' in navigator) {
  const registrarSW = () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registrado:', reg.scope))
      .catch(err => console.log('SW error:', err));
  };
  // Este script se carga de forma dinámica, cuando 'load' ya pudo haber ocurrido
  if (document.readyState === 'complete') registrarSW();
  else window.addEventListener('load', registrarSW);
}
