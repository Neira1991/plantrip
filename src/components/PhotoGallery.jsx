import { useState, useRef, useEffect } from 'react'
import './PhotoGallery.css'

export default function PhotoGallery({ photos, onRefresh, refreshing, readOnly }) {
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const scrollRef = useRef(null)

  // Close lightbox on escape
  useEffect(() => {
    if (lightboxIndex == null) return
    function handleKey(e) {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowRight') setLightboxIndex(i => Math.min(i + 1, photos.length - 1))
      if (e.key === 'ArrowLeft') setLightboxIndex(i => Math.max(i - 1, 0))
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [lightboxIndex, photos.length])

  if (!photos || photos.length === 0) return null

  return (
    <>
      <div className="photo-gallery">
        <div className="photo-gallery-scroll" ref={scrollRef}>
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              className="photo-gallery-item"
              onClick={() => setLightboxIndex(i)}
            >
              <img
                src={photo.thumbnailUrl}
                alt={photo.attribution}
                loading="lazy"
              />
            </button>
          ))}
        </div>
        {!readOnly && onRefresh && (
          <button
            className="photo-gallery-refresh"
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh photos"
          >
            {refreshing ? '...' : '\u21BB'}
          </button>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex != null && photos[lightboxIndex] && (
        <div className="photo-lightbox" onClick={() => setLightboxIndex(null)}>
          <div className="photo-lightbox-content" onClick={e => e.stopPropagation()}>
            <img
              src={photos[lightboxIndex].url}
              alt={photos[lightboxIndex].attribution}
            />
            <div className="photo-lightbox-attribution">
              <a
                href={photos[lightboxIndex].photographerUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Photo by {photos[lightboxIndex].photographerName}
              </a>
              {' on '}
              <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">
                Unsplash
              </a>
            </div>
            <div className="photo-lightbox-nav">
              {lightboxIndex > 0 && (
                <button
                  className="photo-lightbox-prev"
                  onClick={() => setLightboxIndex(i => i - 1)}
                >
                  &larr;
                </button>
              )}
              <span className="photo-lightbox-counter">
                {lightboxIndex + 1} / {photos.length}
              </span>
              {lightboxIndex < photos.length - 1 && (
                <button
                  className="photo-lightbox-next"
                  onClick={() => setLightboxIndex(i => i + 1)}
                >
                  &rarr;
                </button>
              )}
            </div>
            <button
              className="photo-lightbox-close"
              onClick={() => setLightboxIndex(null)}
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </>
  )
}
