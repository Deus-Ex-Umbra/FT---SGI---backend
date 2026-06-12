
export const ESTADOS_FISICOS_ITEM_ACTIVO = ['bueno', 'regular', 'malo'] as const;

export type EstadoFisicoItemActivo = typeof ESTADOS_FISICOS_ITEM_ACTIVO[number];

const ESTADO_FISICO_ALIAS: Record<string, EstadoFisicoItemActivo> = {
  bueno: 'bueno',
  buen: 'bueno',
  bien: 'bueno',

  regular: 'regular',

  malo: 'malo',
  mal: 'malo',
};

export const normalizarEstadoFisicoItem = (estado?: string | null): EstadoFisicoItemActivo | null => {
  const limpio = String(estado ?? '').trim().toLowerCase();
  if (!limpio) return null;
  if ((ESTADOS_FISICOS_ITEM_ACTIVO as readonly string[]).includes(limpio)) return limpio as EstadoFisicoItemActivo;
  return ESTADO_FISICO_ALIAS[limpio] ?? null;
};
