// Passenger loads a CommonJS entry point; the application uses ES modules.
if (typeof PhusionPassenger !== 'undefined') {
  PhusionPassenger.configure({ autoInstall: false });
}
import('./server.mjs').catch(error => {
  console.error('No se pudo iniciar APAIB:', error.message);
  process.exit(1);
});
