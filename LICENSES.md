# Third-party notices

This site is MIT licensed (see `LICENSE`). It ships the following third-party
work, under the terms below.

## 3D model — `public/models/RobotExpressive.glb`

The hero model is **RobotExpressive**, taken unmodified from the three.js
examples.

- Model by **Tomás Laulhé** — https://www.patreon.com/quaternius
- Modifications (facial expression morph targets, FBX2GLTF conversion,
  material cleanup) by **Don McCurdy** — https://donmccurdy.com
- Source: https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive
- **License: CC0 1.0** — public domain, no attribution required. Credited here
  by this repository's convention, and because the creator takes support on
  Patreon.

## Chess engine — `public/stockfish.js`

The chess opponent on `/play` is **Stockfish**, compiled to JavaScript by
Niklas Fiekas. It is **not** original work and is not presented as such
anywhere on the site.

- Stockfish copyright T. Romstad, M. Costalba, J. Kiiski, G. Linscott and other
  contributors. Multi-variant support by Daniel Dugovic and contributors.
- Compiled to JavaScript by Niklas Fiekas <niklas.fiekas@backscattering.de>.
- Source: https://github.com/niklasf/stockfish.js
- **License: GNU General Public License v3.**

`public/stockfish.js` is shipped **unmodified**, with its license header
intact. It is loaded as a standalone Web Worker and is not linked into the
application bundle. The full GPLv3 text is available at
https://www.gnu.org/licenses/gpl-3.0.html and the corresponding source at the
URL above.

## Icons

- [devicon](https://devicon.dev) — MIT
- [simple-icons](https://simpleicons.org) — CC0 1.0
- [react-icons](https://react-icons.github.io/react-icons/) — MIT

Icons are loaded from jsDelivr at runtime and are not redistributed here.
