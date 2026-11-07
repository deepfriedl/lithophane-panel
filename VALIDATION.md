# Validation record

Initial validation: November 6, 2026. No physical prints have been performed.

## Automated geometry

14/14 test groups passed in the available Node runtime, including a 256 × 256 mesh (262,140 triangles). Tests check both successful fixtures and deliberate failures. Run `npm test` to reproduce.

## Browser integration

Tested in the Mac in-app browser using an 80 × 60 PNG with asymmetric color quadrants:

- Upload decoded locally; 100 mm width yielded 75 mm height.
- Preview retained black/white top quadrants and red/gray bottom quadrants.
- Standard detail exported 76,796 triangles, one closed solid, and 0.800–3.200 mm thickness.
- Binary STL download completed, and the UI reported passing internal and read-back checks.
- Downloaded coordinates were independently inspected for correct corner thickness and orientation.

## Independent slicer inspection

Bambu Studio 02.08.02.61 CLI `--info` on a generated 50 × 40 mm gradient STL reported:

```text
number_of_facets = 12284
manifold = yes
number_of_parts = 1
volume = 3999.989258
size_x = 50.000000
size_y = 40.000000
size_z = 3.200000
```

This confirms a separate slicer can load the STL and identify a single manifold part. An attempted CLI toolpath slice exited with code 134 before producing slicing output. No successful toolpath slicing is claimed. The temporary QA data directory was outside the repository; no printer or filament profile is bundled.

## Remaining acceptance checks

- Open exports in your configured slicer and check its mesh warnings, dimensions, orientation, layer preview, and uninterrupted material through the panel.
- Slice uniform white, uniform black, sharp checkerboard, gradient, and an asymmetric labeled photo. Confirm fine detail survives the chosen nozzle and layer height.
- Print a small gradient coupon and a representative photo using the intended filament and backlight. Record filament brand/type/color, nozzle, layer height, print orientation, temperatures, infill strategy, and illumination geometry.
- Select minimum thickness based on both structural strength and brightest-region transmission; choose maximum thickness for dark-region opacity. Repeat coupons before changing application defaults.
- Record actual print results and any slicer repair messages here. Do not mark physical validation complete based only on topology tests.
