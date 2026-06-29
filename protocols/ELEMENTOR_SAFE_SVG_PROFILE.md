# protocols/ELEMENTOR_SAFE_SVG_PROFILE

Version: 0.1.0
Status: active
Purpose: define the MVP compatibility profile for Builder-generated SVG assets intended for Elementor upload or widget use.

## Allowed MVP Features

```text
svg
viewBox
path
line
polyline
circle
rect
simple stroke and fill attributes
fill="none" for decorative line paths
stroke="#000000" when Elementor color controls may be used
stroke-width
stroke-linecap
stroke-linejoin
aria-hidden="true" for decorative assets when appropriate
focusable="false" when appropriate
```

## Discouraged Or Forbidden Unless Compatibility Is Proven

```text
script
foreignObject
animation
event handlers
style blocks
inline CSS styling
defs
gradients
filters
masks
clip paths
feGaussianBlur
feColorMatrix
stroke="url(#...)"
fill="url(#...)"
excessive opacity-only visibility
inline width or height when Elementor should control sizing
```

## Nuance

These features are not all universally invalid SVG. The rule is narrower: Builder must not generate them for Elementor upload or Elementor widget use unless compatibility is proven by the active compatibility profile and source policy.
