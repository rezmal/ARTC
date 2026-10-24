# ARTc
ARTc: Anisotropic Reflectivity Transmissivity Calculator

ARTc computes the main properties of plane seismic waves at a welded interface between two
anisotropic elastic half-spaces: velocities, propagation angles, polarizations, and
reflection/transmission amplitude coefficients. It handles any symmetry class.

## Browser version (recommended)

**Quick start:** download [`ARTC.html`](ARTC.html) and open it in any modern browser. It is a
single file that runs offline. No MATLAB and no installation are needed.

- Enter the 21 stiffnesses C<sub>ij</sub> (GPa) and the density (g/cm³) of each medium, or fill
  them from Vp/Vs, from Thomsen VTI parameters, or by rotating the current matrix (tilt and azimuth).
- **Single angle:** a table of the incident wave and the six scattered waves, with velocity,
  angle, s₃, complex coefficient, |A|, phase, energy fraction, polarization and an energy-balance check.
- **Angle sweep:** coefficient curves against incidence angle, with CSV export.
- **Azimuth–inclination map:** polar maps of any quantity for all six waves. They are computed in a
  background thread and can be exported as CSV.
- Example models, a save/load model file (JSON), and light and dark themes.

Source code is in [`web/`](web) (React and TypeScript). The solver is in
`web/src/lib/artc.ts` and has no UI dependencies.

```bash
cd web
npm install
npm run dev               # development server
npm test                  # solver tests (Zoeppritz, energy conservation, TTI/triclinic)
npm run build:standalone  # rebuild ../ARTC.html
```

The rewrite fixes several bugs in the original MATLAB code; see [`REVIEW.md`](REVIEW.md).
The biggest one: tilted and general anisotropic media gave wrong slownesses because the odd
powers of the slowness polynomial were dropped.

## MATLAB version (original)

The original MATLAB files (`ARTC.m`, `REFLECTIVITY.m` GUI and helpers) are kept for reference.
Run `REFLECTIVITY` in MATLAB to open the GUI, or call
`ARTC(ctop, rotop, cbot, robot, k, inc, azi)` directly.

## Referencing:
Malehmir, R., Schmitt, D.R., 2016. ARTc: Anisotropic reflectivity and transmissivity calculator. Comput. Geosci. 93, 114–126. doi:10.1016/j.cageo.2016.05.008
