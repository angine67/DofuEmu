const MAX_RETRIES = 10
const RETRY_DELAY = 500
const INITIAL_DELAY = 1000
const PADDING = 4
const ALPHA_THRESHOLD = 10
const MIN_DATA_URL_LENGTH = 200

interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function findOpaqueBounds(imageData: ImageData): BoundingBox | null {
  const { width, height, data } = imageData
  let minX = width, minY = height, maxX = 0, maxY = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX <= minX || maxY <= minY) return null
  return {
    minX: Math.max(0, minX - PADDING),
    minY: Math.max(0, minY - PADDING),
    maxX: Math.min(width - 1, maxX + PADDING),
    maxY: Math.min(height - 1, maxY + PADDING),
  }
}

function cropCanvas(source: HTMLCanvasElement, bounds: BoundingBox, doc: Document): string | null {
  const w = bounds.maxX - bounds.minX + 1
  const h = bounds.maxY - bounds.minY + 1
  const tmp = doc.createElement('canvas')
  tmp.width = w
  tmp.height = h
  tmp.getContext('2d')!.drawImage(source, bounds.minX, bounds.minY, w, h, 0, 0, w, h)
  const dataUrl = tmp.toDataURL('image/png')
  return dataUrl.length > MIN_DATA_URL_LENGTH ? dataUrl : null
}

export function captureCharacterIcon(
  charElement: any,
  doc: Document,
  onCapture: (dataUrl: string) => void
) {
  let attempt = 0

  const tryCapture = () => {
    const canvas = charElement.canvas?.rootElement || charElement.rootElement.querySelector('canvas')
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      if (attempt < MAX_RETRIES) { attempt++; setTimeout(tryCapture, RETRY_DELAY) }
      else charElement.rootElement.remove()
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bounds = findOpaqueBounds(ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (!bounds) {
      if (attempt < MAX_RETRIES) { attempt++; setTimeout(tryCapture, RETRY_DELAY) }
      else charElement.rootElement.remove()
      return
    }

    const dataUrl = cropCanvas(canvas, bounds, doc)
    if (dataUrl) {
      charElement.rootElement.remove()
      onCapture(dataUrl)
    } else if (attempt < MAX_RETRIES) {
      attempt++
      setTimeout(tryCapture, RETRY_DELAY)
    } else {
      charElement.rootElement.remove()
    }
  }

  setTimeout(tryCapture, INITIAL_DELAY)
}
