// Explicitly require circularly dependent modules to prevent Vercel NFT from dropping them
require('../dist/modulos/encargado-inventario/entidades/encargado-inventario.entidad.js');
require('../dist/main.js');
