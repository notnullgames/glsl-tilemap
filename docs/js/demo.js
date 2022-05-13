import TileMap from './webgl-tilemap.js'
import { vec2 } from 'gl-matrix'

export default class Renderer {
  constructor (gl, canvas) {
    gl.clearColor(0.0, 0.0, 0.1, 1.0)
    gl.clearDepth(1.0)

    this.tileMap = new TileMap(gl)

    this.tileMap.setSpriteSheet('images/zelda-tiles.png')
    this.tileMap.setTileLayer('images/zelda-all.png', 0)

    this.tileMap.tileSize = 16
    this.tileMap.setTileScale(4)

    this.offset = vec2.create()

    this.zoomLevels = [0.125, 0.25, 0.5, 1, 2, 4]
    this.zoomIndex = 4
    this.zooming = false
    this.zoomPrev = 0
    this.zoomNext = 0
    this.offsetPrev = vec2.create()
    this.offsetNext = vec2.create()
    this.zoomProgress = 0
    this.zoomTime = 250
    this.scaleFactor = this.zoomLevels[this.zoomIndex]

    this.waitingForDraw = false
    this.canvas = canvas

    this.bindEvents(canvas)
  }

  bindEvents (canvas) {
    let tracking = false
    let lastX, lastY

    canvas.addEventListener('mousedown', (ev) => {
      tracking = true
      lastX = ev.pageX
      lastY = ev.pageY
    }, false)

    canvas.addEventListener('mousemove', (ev) => {
      if (tracking) {
        this.pan(ev.pageX - lastX, ev.pageY - lastY)
        lastX = ev.pageX
        lastY = ev.pageY
      }
    }, false)

    document.addEventListener('mouseup', (ev) => {
      tracking = false
    }, false)

    canvas.addEventListener('mousewheel', (ev) => {
      this.zoom(ev.wheelDeltaY)
      ev.preventDefault()
    }, false)

    canvas.addEventListener('touchstart', (ev) => {
      tracking = true
      lastX = ev.touches[0].pageX
      lastY = ev.touches[0].pageY
      ev.preventDefault()
    }, false)

    canvas.addEventListener('touchmove', (ev) => {
      if (tracking) {
        this.pan(ev.touches[0].pageX - lastX, ev.touches[0].pageY - lastY)

        lastX = ev.touches[0].pageX
        lastY = ev.touches[0].pageY
      }
      ev.preventDefault()
    }, false)

    document.addEventListener('touchend', (ev) => {
      tracking = false
      ev.preventDefault()
    }, false)
  }

  resize (gl, canvas) {
    gl.viewport(0, 0, canvas.width, canvas.height)
    this.tileMap.resizeViewport(canvas.width, canvas.height)
  }

  pan (x, y) {
    this.offset[0] -= x / this.scaleFactor
    this.offset[1] -= y / this.scaleFactor

    const maxExtentX = this.tileMap.layers[0].textureSize[0] * this.scaleFactor * this.tileMap.tileSize
    const maxExtentY = this.tileMap.layers[0].textureSize[1] * this.scaleFactor * this.tileMap.tileSize

    const maxDiffX = maxExtentX - (this.tileMap.viewportSize[0] + (this.offset[0] * this.scaleFactor))
    if (maxDiffX < 0) { this.offset[0] += maxDiffX / this.scaleFactor }

    const maxDiffY = maxExtentY - (this.tileMap.viewportSize[1] + (this.offset[1] * this.scaleFactor))
    if (maxDiffY < 0) { this.offset[1] += maxDiffY / this.scaleFactor }

    if (this.offset[0] < 0) { this.offset[0] = 0 }
    if (this.offset[1] < 0) { this.offset[1] = 0 }
  }

  zoom (zoom) {
    // XXX: I broke zoom, somhow
    //     if (!this.zooming) {
    //       this.zoomIndex += (zoom > 0 ? 1 : -1)
    //       if (this.zoomIndex < 0) { this.zoomIndex = 0 }
    //       if (this.zoomIndex >= this.zoomLevels.length) { this.zoomIndex = this.zoomLevels.length - 1 }
    //
    //       this.zoomPrev = this.scaleFactor
    //       this.zoomNext = this.zoomLevels[this.zoomIndex]
    //       this.zoomProgress = 0
    //
    //       vec2.set(this.offset, this.offsetPrev)
    //       const moveX = ((this.tileMap.viewportSize[0] / this.zoomNext) - (this.tileMap.viewportSize[0] / this.zoomPrev)) * 0.5
    //       const moveY = ((this.tileMap.viewportSize[1] / this.zoomNext) - (this.tileMap.viewportSize[1] / this.zoomPrev)) * 0.5
    //       this.offsetNext[0] = this.offset[0] - moveX
    //       this.offsetNext[1] = this.offset[1] - moveY
    //
    //       if (this.zoomPrev !== this.zoomNext) {
    //         this.zooming = true
    //       }
    //     }
  }

  draw (gl, timing) {
    if (this.zooming) {
      this.zoomProgress += (timing.frameTime / this.zoomTime)
      if (this.zoomProgress >= 1) {
        this.zoomProgress = 1
        this.zooming = false
        this.scaleFactor = this.zoomNext
        // Make sure to clamp the offset to an "even" number
        this.offset[0] = Math.floor(this.offset[0] * this.scaleFactor) / this.scaleFactor
        this.offset[1] = Math.floor(this.offset[1] * this.scaleFactor) / this.scaleFactor
      } else {
        this.scaleFactor = this.zoomPrev + this.zoomProgress * (this.zoomNext - this.zoomPrev)
        vec2.lerp(this.offsetPrev, this.offsetNext, this.zoomProgress, this.offset)
      }

      this.tileMap.setTileScale(this.scaleFactor)
      this.pan(0, 0)
    }

    this.tileMap.draw(this.offset[0], this.offset[1])
  }
}
