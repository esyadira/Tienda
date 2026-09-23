// Versión de escritorio (Electron): window.prompt no existe allí, se reemplaza por una ventana propia.
// En el navegador normal window.bodegaEscritorio no existe y este archivo no hace nada.
if (window.bodegaEscritorio) {
  window.prompt = (mensaje, valor) => window.bodegaEscritorio.prompt(mensaje, valor);
}
