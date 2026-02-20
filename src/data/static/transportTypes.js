/**
 * Canonical transport type definitions used across the app.
 */

/** Array form — for rendering grids, selects, etc. */
export const TRANSPORT_TYPES = [
  { value: 'train', label: 'Train', icon: '\u{1F686}' },
  { value: 'car', label: 'Car', icon: '\u{1F697}' },
  { value: 'plane', label: 'Plane', icon: '\u2708\uFE0F' },
  { value: 'bus', label: 'Bus', icon: '\u{1F68C}' },
  { value: 'ferry', label: 'Ferry', icon: '\u26F4\uFE0F' },
  { value: 'walk', label: 'Walk', icon: '\u{1F6B6}' },
  { value: 'other', label: 'Other', icon: '\u{1F4CD}' },
]

/** Map form — for quick lookup by value key. */
export const TRANSPORT_MAP = Object.fromEntries(
  TRANSPORT_TYPES.map(t => [t.value, { label: t.label, icon: t.icon }])
)
