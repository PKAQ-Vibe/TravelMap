---
name: travel-map-planner
description: Plan, build, or revise interactive travel maps with verified POIs, ordered DAY itineraries, directional AMap routes, day regions, local attraction imagery, and floating map UI. Use for React/Vite/L7/Gaode travel-map work or when organizing travel-map data and interaction rules; do not use for ordinary itinerary prose without a map deliverable.
---

# Travel Map Planner

Build the map as a data-driven working surface. Treat locations, day order, prices, reservation lead times, and dates as user-owned facts: never infer or silently reorder them.

## Workflow

1. Inspect the existing project and its unified travel-data file before editing.
2. Normalize aliases into display name, official name, and search name. Resolve coordinates from Gaode Map or L7 Editor in GCJ-02. Persist verified results; never geocode at runtime when stable coordinates are known.
3. Keep each destination, its places, ordered connections, and day plans together in one data source. Every connection endpoint and day member must resolve to a stored place.
4. Build routes strictly in the user's stated order. For Gaode maps, use native `AMap.Polyline` with `showDir`, `dirColor`, dashed stroke, rounded joins, and an appropriate visible width. Do not simulate arrows with detached DOM icons.
5. Generate one region per DAY from that day's member points. The region must contain every member. Use a filled polygon with a solid outline and distinct day colors. Expand locally at hull corners with rounded buffers; do not scale the entire polygon just because one point is far away.
6. Provide DAY filters after the selected city's date. Support individual DAY display and an ALL option. Route, region, outline, and DAY label must share the same visibility state. If schedule display is off, none of them may remain visible.
7. Store attraction images under the project's public assets and reference local URLs. Verify every image exists and is valid before building.
8. Run data-integrity checks and the production build. Do not start a server when the user says they will run it themselves.

## Interface invariants

- The map fills the viewport; all controls float above it.
- Use the project's requested theme and UI library. For the current baseline, use `animal-island-ui`, grass-cyan colors, translucent surfaces, 2px control corner radii, and a Gaode base map.
- The top city list fills the width, shows only configured cities, scrolls with left/right arrows, and displays each city's date below its button.
- The right detail panel starts fully hidden and closes when clicking outside it. Clicking either a map marker or a bottom attraction image opens it.
- Bottom attraction cards are local-image squares, `8vh` high, with 4px corners. Hover shows only the place name; the image itself is always visible.
- Bottom controls place minus on the left, percentage in the middle, and plus on the right. The map date remains at bottom right.
- “显示日程” sits above “显示名称”. Unchecked boxes must not show a check mark. Names are shown by default; schedules are hidden by default.
- Reservation places append `（提前 x 天约）` wherever their place name is presented. Show stored price in the detail panel.

For work on the established Harbin map, read [references/harbin-baseline.md](references/harbin-baseline.md) before changing data, routes, regions, or layout.
