# Code review of the MATLAB ARTc package

This review covers the MATLAB sources (`ARTC.m`, `REFLECTIVITY.m` and the helper
functions). Each bug listed here is fixed in the browser rewrite under `web/`
(`web/src/lib/artc.ts`), and the test suite checks those fixes
(`web/src/lib/*.test.ts`). The MATLAB files are left unchanged as the reference
implementation from the paper.

## Bugs that change the physics

1. **The slowness sextic loses its odd powers (`ChrstKel_RT.m`).**
   `roots(P(1:2:end))` keeps only the even coefficients of the 6th-degree
   polynomial in s3 and then takes `±sqrt`. That shortcut is valid only when the
   medium has a horizontal mirror plane (isotropic, VTI, aligned orthorhombic).
   Tilted TI, monoclinic media with a non-horizontal mirror plane, and triclinic
   media have non-zero odd coefficients. For those media the vertical slownesses,
   polarizations and every coefficient come out wrong, even though the package
   says it handles "all anisotropic media". The test `tilted TI needs the odd
   powers of the sextic` shows that the even-only "roots" do not satisfy the
   real sextic.
   *Fix:* solve the full sextic, and use the cubic in s3² only when the odd
   coefficients really are zero.

2. **Mode ordering depends on the MATLAB release (`chrisKel.m`).**
   `[pol,ev] = eigs(T)` is called on a 3×3 matrix, and the code assumes ascending
   order: qP is taken from column 3 and qS1 from column 2. Since R2017b, `eigs`
   returns the largest eigenvalues first. On current MATLAB the incident qP and
   qS2 waves are therefore swapped.
   *Fix:* a symmetric eigen-solver with an explicit descending sort.

3. **Up-going and down-going waves are chosen by the sign of s3.**
   `abs(real(s3))` / `-abs(real(s3))` assumes that phase and energy travel the
   same way vertically. That fails for backward waves in strongly anisotropic
   media. `sort` on complex numbers orders by magnitude, which also mixes up
   evanescent and propagating roots.
   *Fix:* real roots are classified by the sign of the vertical energy flux, and
   evanescent roots by their decay direction.

4. **Polarizations are taken from the wrong eigenvector (`ARTC.m`).**
   For each scattered root the code builds a *direction* from the slowness,
   solves a new Christoffel problem along it, and keeps eigenvector `pp`. This
   assumes the root lies on the pp-th sheet along its own direction. Near
   shear-wave singularities it does not, so the polarization of the other shear
   wave is used. For post-critical (complex) slownesses, the "direction" is a
   complex vector and the eigen-problem has no physical meaning.
   *Fix:* each polarization is the null vector of Γ(s) − I at the actual
   slowness root.

5. **Degenerate shear waves were handled by changing the medium (`CC.m`).**
   When C44 ≈ C55 the code multiplies them by (1 ∓ 1e-5). This changes the
   user's medium. It also makes the shear polarizations follow the crystal axes
   instead of SV/SH, so for an isotropic medium at azimuths other than 0°/90°,
   "qS1" and "qS2" can be mixtures of SV and SH.
   *Fix:* at a double root the null space is split explicitly into SV and SH.

6. **The boundary system is regularized (`boundary_condition.m`).**
   `R = (G'*G + 1e-5*eye(6)) \ (G'*I)` solves a Tikhonov-damped least-squares
   problem rather than `G R = I`. This biases every coefficient, most strongly
   near critical angles where `G` is poorly conditioned.
   *Fix:* a direct solve with partial pivoting, plus a residual check.

7. **Phase loses its quadrant (`ARTC.m`).** `atan(-imag(RR)./real(RR))` maps a
   coefficient of −0.3 to a phase of 0° instead of 180°.
   *Fix:* `atan2`.

8. **"Calc & Plot" plots the real part, not the amplitude (`REFLECTIVITY.m`).**
   `out = real(ARTC(...))` throws away the imaginary part. Past a critical angle
   the plotted "Amp" values are the real parts of complex coefficients.
   *Fix:* the UI offers |A|, Re(A), phase and energy as separate quantities.

## Smaller defects

- `ARTC.m`: `SI = [norm(SI(:,1)); ...]` computes the norms of the scalar
  components of a row vector, not the slowness magnitude. The result is unused.
- `ChrstKel_RT.m`: `if length(s33) < 3, s33(2:3) = 1e4` overwrites a valid
  second root and inserts arbitrary numbers.
- `chrisKel.m`: the `if n(1)==0 && n(2)==0` branch assigns the same values as
  the code after it, so it is dead code. Only the qP polarization gets a
  deterministic sign; the shear signs are arbitrary, which makes the signs of
  shear coefficients arbitrary too.
- `rot_psi.m`: the comment says it rotates about x1, but the matrix rotates about
  x2. Two Bond-matrix entries use the wrong direction cosines (`2*a23*a12` should
  be `2*a23*a21`, and `a31*a21` should be `a13*a21`). This is harmless only
  because those cosines are zero for this particular rotation. The function is
  also never called.
- `REFLECTIVITY.m`:
  - `str2num` evaluates whatever is typed into a field as MATLAB code.
  - An empty field makes the matrix concatenation fail.
  - There is no `try/catch`, so after an error both buttons stay stuck on "BUSY".
  - The progress text runs to "81/80".
  - The azimuth grid `0:10:360` computes 0° and 360° twice.
  - The plots have no titles, axes or colour bars.
  - Reset clears only the table.
- `artc.sh` / `runARTc.sh`: both call `run_artc.m`, which was deleted from the
  repository. `artc.sh` also has a broken shebang (`#!bin/bash`), and
  `matlab -r run_artc.m` passes a file name where a statement is expected.

## Convention notes

- Coefficients are displacement-amplitude ratios. Evanescent polarizations are
  normalized so that p·p = 1, the Zoeppritz convention, so magnitudes match
  Aki & Richards (2002, eq. 5.40) before and after the critical angle.
- Energy coefficients are new. Their sum is shown as an energy balance and
  equals 1 to round-off whenever at most one scattered wave is evanescent.
