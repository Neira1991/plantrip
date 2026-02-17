import './CountryShape.css'

const SVG_BASE = 'https://cdn.jsdelivr.net/gh/djaiss/mapsicon@master/all'

export default function CountryShape({ code, colors, size = 28 }) {
  const svgUrl = `${SVG_BASE}/${code.toLowerCase()}/vector.svg`

  const bg =
    colors.length === 1
      ? colors[0]
      : `linear-gradient(135deg, ${colors.map((c, i) => `${c} ${Math.round((i / (colors.length - 1)) * 100)}%`).join(', ')})`

  return (
    <div
      className="country-shape"
      style={{
        width: size,
        height: size,
        background: bg,
        WebkitMaskImage: `url(${svgUrl})`,
        maskImage: `url(${svgUrl})`,
      }}
      aria-hidden="true"
    />
  )
}
