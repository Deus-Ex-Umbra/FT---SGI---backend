export const ESTADOS_ITEM_ACTIVO = [
  'disponible',
  'en_prestamo',
  'en_mantenimiento',
  'extraviado',
  'dado_de_baja',
] as const;

export type EstadoItemActivo = typeof ESTADOS_ITEM_ACTIVO[number];

export const ESTADO_ALIAS: Record<string, EstadoItemActivo> = {
  'en prestamo': 'en_prestamo',
  enprestamo: 'en_prestamo',
  prestado: 'en_prestamo',
  prestamo: 'en_prestamo',
  en_revision: 'en_mantenimiento',
  revision: 'en_mantenimiento',
  'en revision': 'en_mantenimiento',
  enrevision: 'en_mantenimiento',
  revisado: 'en_mantenimiento',
  mantenimiento: 'en_mantenimiento',
  'en mantenimiento': 'en_mantenimiento',
  enmantenimiento: 'en_mantenimiento',
  extraviado: 'extraviado',
  perdido: 'extraviado',

  baja: 'dado_de_baja',
  dado_de_baja: 'dado_de_baja',
  buen_estado: 'disponible',
  regular: 'disponible',
  danado: 'en_mantenimiento',
};
export const TRANSICIONES_ESTADO_ITEM: Record<EstadoItemActivo, EstadoItemActivo[]> = {
  disponible: ['en_prestamo', 'en_mantenimiento', 'extraviado', 'dado_de_baja'],
  en_prestamo: ['disponible', 'en_mantenimiento', 'extraviado'],
  en_mantenimiento: ['disponible', 'extraviado', 'dado_de_baja'],
  extraviado: ['disponible', 'en_mantenimiento', 'dado_de_baja'],
  dado_de_baja: [],
};
export const TRANSICIONES_CON_JUSTIFICACION: Array<{ desde: EstadoItemActivo; hacia: EstadoItemActivo }> = [
  { desde: 'en_prestamo', hacia: 'extraviado' },
  { desde: 'disponible', hacia: 'dado_de_baja' },
  { desde: 'en_mantenimiento', hacia: 'dado_de_baja' },
  { desde: 'extraviado', hacia: 'dado_de_baja' },
];

export const requiereJustificacionTransicion = (
  desde: EstadoItemActivo,
  hacia: EstadoItemActivo,
): boolean => TRANSICIONES_CON_JUSTIFICACION.some((t) => t.desde === desde && t.hacia === hacia);

export const transicionesPermitidas = (desde: EstadoItemActivo): EstadoItemActivo[] => TRANSICIONES_ESTADO_ITEM[desde] ?? [];

export const normalizarEstadoItem = (estado: string): EstadoItemActivo | null => {
  const limpio = estado.trim().toLowerCase();
  if (!limpio) return null;
  if ((ESTADOS_ITEM_ACTIVO as readonly string[]).includes(limpio)) return limpio as EstadoItemActivo;
  return ESTADO_ALIAS[limpio] ?? null;
};
