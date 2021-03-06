/*
 * Copyright (c) 2011 Brandon Jones
 *
 * This software is provided 'as-is', without any express or implied
 * warranty. In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 *    1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 *
 *    2. Altered source versions must be plainly marked as such, and must not
 *    be misrepresented as being the original software.
 *
 *    3. This notice may not be removed or altered from any source
 *    distribution.
 */

// Ported to ESM/modern-syntax by David Konsumer

/*
 * This file creates the renderer, starts the render loop, manages the FPS counter
 * and handles logic for the fullscreen button. It generally should not need to be
 * edited, and most rendering logic should go in renderer.js
 */

/* global screen */

import glUtil from './gl-util.js'

export class GLContextHelper {
  constructor (canvas, fullscreenElement) {
    let resizeTimeout

    if (!fullscreenElement) {
      fullscreenElement = canvas
    }

    //
    // Create gl context and start the render loop
    //
    this.canvas = canvas
    this.fullscreenElement = null
    this.fullscreenSupported = false
    this.mobileDevice = false
    this.forceMobile = false
    this.lastWidth = 0
    this.renderer = null
    this.canvasScale = 1.0

    this.gl = glUtil.getContext(canvas, { alpha: false })

    if (!this.gl) {
      glUtil.showGLFailed(canvas)
    } else {
      const resizeCallback = () => { this.windowResized() }

      // On mobile devices, the canvas size can change when we rotate. Watch for that:
      document.addEventListener('orientationchange', resizeCallback, false)

      // Note: This really sucks, but it's apparently the best way to get this to work on Opera mobile
      window.addEventListener('resize', function () {
        if (resizeTimeout) { clearTimeout(resizeTimeout) }
        resizeTimeout = setTimeout(resizeCallback, 250)
      }, false)

      this.setFullscreenElement(fullscreenElement)
    }
  }

  start (renderer, stats) {
    if (!renderer.draw) {
      throw new Error('Object passed to startRenderLoop must have a draw function')
    }

    this.renderer = renderer

    const startTime = Date.now()
    let lastTimeStamp = startTime
    const canvas = this.canvas
    const gl = this.gl

    const timingData = {
      startTime: startTime,
      timeStamp: 0,
      elapsed: 0,
      frameTime: 0
    }

    this.windowResized(true)

    function nextFrame () {
      const time = Date.now()
      window.requestAnimationFrame(nextFrame, canvas)

      timingData.timeStamp = time
      timingData.elapsed = time - startTime
      timingData.frameTime = time - lastTimeStamp

      if (stats) { stats.begin() }
      renderer.draw(gl, timingData)
      if (stats) { stats.end() }

      lastTimeStamp = time
    }
    window.requestAnimationFrame(nextFrame, canvas)
  }

  windowResized (force) {
    if (this.lastWidth === window.innerWidth && !force) { return }

    const canvas = this.canvas

    // We'll consider "mobile" and "screen deprived" to be the same thing :)
    this.lastWidth = window.innerWidth
    this.mobileDevice = this.forceMobile || (screen.width <= 960)

    // If we don't set this here, the rendering will be skewed
    if (this.mobileDevice) {
      canvas.width = window.innerWidth * window.devicePixelRatio
      canvas.height = window.innerHeight * window.devicePixelRatio
    } else {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    if (this.renderer && this.renderer.resize) {
      this.renderer.resize(this.gl, canvas)
    }
  }

  setFullscreenElement (fullscreenElement) {
    const canvas = this.canvas
    const canvasOriginalWidth = canvas.offsetWidth
    const canvasOriginalHeight = canvas.offsetHeight

    this.fullscreenElement = fullscreenElement
    this.fullscreenSupported = this.gl

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenEnabled) {
        canvas.width = screen.width
        canvas.height = screen.height
      } else {
        canvas.width = canvasOriginalWidth
        canvas.height = canvasOriginalHeight
      }

      if (this.renderer && this.renderer.resize) {
        this.renderer.resize(this.gl, canvas)
      }
    }, false)
  }

  toggleFullscreen () {
    if (!document.fullscreenEnabled) {
      this.fullscreenElement.requestFullScreen()
    } else {
      document.exitFullscreen()
    }
  }
}

export default GLContextHelper
