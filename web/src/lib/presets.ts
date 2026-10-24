import { isotropicFromLame, Medium, rotateStiffness, vtiFromThomsen } from './elastic';

export interface Preset {
  id: string;
  label: string;
  description: string;
  top: { name: string; medium: Medium };
  bottom: { name: string; medium: Medium };
}

const shale = vtiFromThomsen(3.0, 1.5, 0.25, 0.1, 0.2, 2.4);

export const PRESETS: Preset[] = [
  {
    id: 'iso-iso',
    label: 'Isotropic / isotropic (original GUI example)',
    description: 'The "iso-iso" button of the MATLAB GUI: Vp 2 km/s, Vs 1 km/s over a 5% faster layer.',
    top: { name: 'Isotropic', medium: { C: isotropicFromLame(4, 2), rho: 2 } },
    bottom: { name: 'Isotropic (+5%)', medium: { C: isotropicFromLame(4.41, 2.205), rho: 2 } },
  },
  {
    id: 'shale-sand',
    label: 'VTI shale over isotropic sand',
    description: 'Thomsen shale (eps 0.25, delta 0.1, gamma 0.2) over a fast isotropic sand.',
    top: { name: 'VTI shale', medium: { C: shale, rho: 2.4 } },
    bottom: {
      name: 'Isotropic sand',
      medium: { C: isotropicFromLame(2.2 * (3.5 ** 2 - 2 * 2.0 ** 2), 2.2 * 2.0 ** 2), rho: 2.2 },
    },
  },
  {
    id: 'tti-iso',
    label: 'Tilted TI (40 degrees) over isotropic',
    description: 'The same shale with its symmetry axis tilted 40 degrees towards x1: needs the full sextic.',
    top: { name: 'TTI shale (tilt 40)', medium: { C: rotateStiffness(shale, 40, 0), rho: 2.4 } },
    bottom: {
      name: 'Isotropic sand',
      medium: { C: isotropicFromLame(2.2 * (3.5 ** 2 - 2 * 2.0 ** 2), 2.2 * 2.0 ** 2), rho: 2.2 },
    },
  },
  {
    id: 'iso-hti',
    label: 'Isotropic over fractured HTI',
    description: 'Vertical fractures normal to x1 (VTI rotated 90 degrees): azimuthal AVO.',
    top: { name: 'Isotropic cap', medium: { C: isotropicFromLame(2.3 * (3 ** 2 - 2 * 1.6 ** 2), 2.3 * 1.6 ** 2), rho: 2.3 } },
    bottom: {
      name: 'HTI fractured',
      medium: { C: rotateStiffness(vtiFromThomsen(3.6, 2.0, -0.1, -0.15, -0.08, 2.4), 90, 0), rho: 2.4 },
    },
  },
];
