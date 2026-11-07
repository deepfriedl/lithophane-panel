# Lithophane Panel

A dependency-free browser application that turns an image into a flat, rectangular lithophane STL. Images stay on your device. No accounts, server processing, remote assets, telemetry, or runtime packages.

**Initial version:** geometry and browser export tested; independent slicer mesh inspection passed. Full toolpath slicing and physical prints are still pending. Do not interpret the checks as evidence of print quality or calibrated optical performance.

## Run locally

Clone the repository, enter its directory, and run:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open http://127.0.0.1:8080 in a modern browser. Stop the server with Ctrl+C. The server only serves static files; image processing and export happen in the browser. ES modules require HTTP, so opening `index.html` directly as a file is unsupported. The same files can be served by any static web host.

1. Choose an image supported by your browser (PNG and JPEG are good starting points).
2. Set width in millimeters. Height follows the decoded image aspect ratio.
3. Set minimum and maximum thickness. Defaults of 0.8 and 3.2 mm are provisional.
4. Choose sample detail and select **Validate & download STL**.
5. Inspect dimensions, orientation, thin regions, and complete layers in your slicer before printing.

Image transparency is composited over white. Decoded EXIF orientation is respected. A weighted brightness value (0.2126 R + 0.7152 G + 0.0722 B, using browser-decoded channel values) maps linearly to thickness:

```text
thickness = minimum + (1 - brightness) × (maximum - minimum)
```

This is a simple visual mapping, not a calibrated light-transmission model. There is no crop, contrast adjustment, border, or 3D preview in this version. The preview shows the source image as seen from the relief side.

## Geometry contract

The model occupies X = 0…width, Y = 0…height, Z = 0…thickness. X points right and Y points up when looking toward the relief face. Canvas image rows are flipped into model Y coordinates, preserving image orientation. Light enters through the flat back at Z = 0; the relief faces +Z.

A rectangular lattice supplies two vertices per sample: one on the relief and one on the flat back. Each grid cell contributes two front and two back triangles. Boundary quads close the perimeter. Surfaces share vertex indices at all adjoining edges, including the perimeter. There are no separate shells or overlapping border objects.

Before a download, the application checks:

- Finite coordinates, unique vertex positions, valid indices, no duplicate or zero-area triangles.
- Every undirected edge has exactly two incident faces with opposite directed traversal.
- One connected component, all vertices used, and spherical Euler characteristic (V − E + F = 2).
- Positive signed volume; with the winding and height-field checks, faces point outward.
- Exact regular XY coordinates, a flat zero-height back, and front heights within the thickness interval.
- Exact expected panel triangulation and complete matching surface coverage.

### Self-intersection check

This is a specialized height-field certificate, rather than a general-purpose triangle-intersection engine. Each surface is a graph over a fixed, nonoverlapping XY triangulation. Front heights are strictly positive and the back is zero. Side walls occupy only the rectangular perimeter. Thus front, back, and walls can meet only along their intended shared boundaries. The validator verifies the grid, front/back positions, thicknesses, and full expected triangulation. This rules out crossings for this panel family, including steep checkerboard reliefs. It does not certify arbitrary imported meshes.

### STL round trip

Binary STL stores float32 coordinates separately for each triangle. All model coordinates are quantized to float32 **before** validation and serialization. Front heights round upward, maintaining the requested minimum (maximum can exceed the requested value by at most one float32 rounding step, less than 0.000001 mm in the supported range).

The exact bytes intended for download are parsed again. Connectivity is rebuilt by welding matching coordinate triples, without a proximity tolerance that could hide cracks. The reconstructed mesh runs the topology/winding/volume checks again. Its coordinate-based face set must exactly match the certified panel, so changed positions, missing faces, duplicate faces, and export cracks block the download. Stored STL normals are advisory; winding and geometry define the solid.

Limits: width 10–400 mm; resulting height 1–2000 mm; minimum thickness 0.4–8 mm; maximum thickness up to 12 mm; longest sample dimension 96, 160, or 256. The other dimension follows the image ratio, with at least two samples. Large dimensions are allowed for geometry and may exceed your printer bed. Dimensions are subject to STL float32 precision. Detail is a sample count, not printer resolution; the UI reports actual sample spacing. Very narrow image ratios are intentionally rejected when the resulting height is out of range. Image file size is capped at 40 MB and decoded images at 80 megapixels; decoding itself can consume significant memory. Fine detail can briefly pause the UI during synchronous checks.

## Tests

With Node.js 20 or newer:

```sh
npm test
```

No install step is needed. Tests cover uniform black/white, gradients, checkerboards, seeded random heights, a full 256 × 256 mesh, equal thicknesses, minimum grids, extreme dimensions, analytic volume, float32 minimum retention, damaged topology, reversed winding, disconnected solids, grid violations, subminimum thickness, corrupted coordinates, malformed STL, and invalid inputs. GitHub Actions runs this suite.

See [VALIDATION.md](VALIDATION.md) for observed results and the remaining slicer/print checks.

## Project layout

- `index.html`, `style.css`, `app.js`: local image input, sampling, preview, controls, and download.
- `mesh.js`: mesh construction, validators, binary STL writer and reader.
- `tests/run.js`: dependency-free geometry regression suite.

MIT licensed. Contributions that strengthen export verification are welcome. Keep external network requests out of the image-processing path.
