export const ESTADOS_ITEM_ACTIVO = [
  'buen_estado',
  'regular',
  'en_mantenimiento',
  'en_prestamo',
  'revision',
  'dado_de_baja',
  'danado',
] as const;

export type EstadoItemActivo = typeof ESTADOS_ITEM_ACTIVO[number];

export const ESTADO_ALIAS: Record<string, EstadoItemActivo> = {
  'en prestamo': 'en_prestamo',
  enprestamo: 'en_prestamo',
  prestado: 'en_prestamo',
  prestamo: 'en_prestamo',
  revision: 'revision',
  revisado: 'revision',
  baja: 'dado_de_baja',
  dado_de_baja: 'dado_de_baja',
  danado: 'danado',
};

export const TRANSICIONES_ESTADO_ITEM: Record<EstadoItemActivo, EstadoItemActivo[]> = {
  buen_estado: ['regular', 'en_mantenimiento', 'en_prestamo', 'revision'],
  regular: ['buen_estado', 'en_mantenimiento', 'en_prestamo', 'revision'],
  en_mantenimiento: ['buen_estado', 'regular', 'revision'],
  en_prestamo: ['revision', 'buen_estado'],
  revision: ['buen_estado', 'regular', 'en_mantenimiento', 'dado_de_baja'],
  dado_de_baja: [],
  danado: ['revision', 'dado_de_baja'],
};

export const TRANSICIONES_CON_JUSTIFICACION: Array<{ desde: EstadoItemActivo; hacia: EstadoItemActivo }> = [
  { desde: 'en_prestamo', hacia: 'revision' },
  { desde: 'revision', hacia: 'dado_de_baja' },
  { desde: 'danado', hacia: 'dado_de_baja' },
];

export const requiereJustificacionTransicion = (
  desde: EstadoItemActivo,
  hacia: EstadoItemActivo,
): boolean => TRANSICIONES_CON_JUSTIFICACION.some((t) => t.desde === desde && t.hacia === hacia);

export const normalizarEstadoItem = (estado: string): EstadoItemActivo | null => {
  const limpio = estado.trim().toLowerCase();
  if (!limpio) return null;
  if ((ESTADOS_ITEM_ACTIVO as readonly string[]).includes(limpio)) return limpio as EstadoItemActivo;
  return ESTADO_ALIAS[limpio] ?? null;
};
