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

/* global Image */

const vendorPrefixes = ['', 'WEBKIT_', 'MOZ_']

// Shader
const quadVS = `
attribute vec2 position;
attribute vec2 texture;

varying vec2 texCoord;

void main(void) {
  texCoord = texture;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const quadFS = `
precision highp float;

uniform sampler2D diffuse;

varying vec2 texCoord;

void main(void) {
  vec4 color = texture2D(diffuse, texCoord);
  gl_FragColor = vec4(color.rgb, color.a);
}
`

let quadShader = null
let quadVertBuffer = null

const textureLoader = (function createTextureLoader () {
  const MAX_CACHE_IMAGES = 16

  const textureImageCache = new Array(MAX_CACHE_IMAGES)
  let cacheTop = 0
  let remainingCacheImages = MAX_CACHE_IMAGES
  const pendingTextureRequests = []

  const TextureImageLoader = function (loadedCallback) {
    const self = this

    this.gl = null
    this.texture = null
    this.callback = null

    this.image = new Image()
    this.image.addEventListener('load', function () {
      const gl = self.gl
      gl.bindTexture(gl.TEXTURE_2D, self.texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, self.image)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.generateMipmap(gl.TEXTURE_2D)

      loadedCallback(self)
      if (self.callback) { self.callback(self.texture) }
    })
  }

  TextureImageLoader.prototype.loadTexture = function (gl, src, texture, callback) {
    this.gl = gl
    this.texture = texture
    this.callback = callback
    this.image.src = src
  }

  const PendingTextureRequest = function (gl, src, texture, callback) {
    this.gl = gl
    this.src = src
    this.texture = texture
    this.callback = callback
  }

  function releaseTextureImageLoader (til) {
    let req
    if (pendingTextureRequests.length) {
      req = pendingTextureRequests.shift()
      til.loadTexture(req.gl, req.src, req.texture, req.callback)
    } else {
      textureImageCache[cacheTop++] = til
    }
  }

  return function (gl, src, texture, callback) {
    let til

    if (cacheTop) {
      til = textureImageCache[--cacheTop]
      til.loadTexture(gl, src, texture, callback)
    } else if (remainingCacheImages) {
      til = new TextureImageLoader(releaseTextureImageLoader)
      til.loadTexture(gl, src, texture, callback)
      --remainingCacheImages
    } else {
      pendingTextureRequests.push(new PendingTextureRequest(gl, src, texture, callback))
    }
  }
})()

const ShaderWrapper = function (gl, program) {
  let i, attrib, uniform, count, name

  this.program = program
  this.attribute = {}
  this.uniform = {}

  count = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
  for (i = 0; i < count; i++) {
    attrib = gl.getActiveAttrib(program, i)
    this.attribute[attrib.name] = gl.getAttribLocation(program, attrib.name)
  }

  count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
  for (i = 0; i < count; i++) {
    uniform = gl.getActiveUniform(program, i)
    name = uniform.name.replace('[0]', '')
    this.uniform[name] = gl.getUniformLocation(program, name)
  }
}

export default {
  ShaderWrapper: ShaderWrapper,

  getContext: function (canvas, options) {
    let context

    if (canvas.getContext) {
      try {
        context = canvas.getContext('webgl', options)
        if (context) { return context }
      } catch (ex) {}

      try {
        context = canvas.getContext('experimental-webgl', options)
        if (context) { return context }
      } catch (ex) {}
    }

    return null
  },

  showGLFailed: function (element) {
    const errorElement = document.createElement('div')
    let errorHTML = '<h3>Sorry, but a WebGL context could not be created</h3>'
    errorHTML += 'Either your browser does not support WebGL, or it may be disabled.<br/>'
    errorHTML += 'Please visit <a href="http://get.webgl.org">http://get.webgl.org</a> for '
    errorHTML += 'details on how to get a WebGL enabled browser.'
    errorElement.innerHTML = errorHTML
    errorElement.id = 'gl-error'
    element.parentNode.replaceChild(errorElement, element)
  },

  createProgram: function (gl, vertexShaderSource, fragmentShaderSource) {
    const shaderProgram = gl.createProgram()
    const vs = this.compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER)
    const fs = this.compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER)

    gl.attachShader(shaderProgram, vs)
    gl.attachShader(shaderProgram, fs)
    gl.linkProgram(shaderProgram)

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      console.error('Shader program failed to link')
      gl.deleteProgram(shaderProgram)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      return null
    }

    return new ShaderWrapper(gl, shaderProgram)
  },

  compileShader: function (gl, source, type) {
    const shaderHeader = '\n'

    const shader = gl.createShader(type)

    gl.shaderSource(shader, shaderHeader + source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      let typeString = ''
      switch (type) {
        case gl.VERTEX_SHADER: typeString = 'VERTEX_SHADER'; break
        case gl.FRAGMENT_SHADER: typeString = 'FRAGMENT_SHADER'; break
      }
      console.error(typeString, gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }

    return shader
  },

  getExtension: function (gl, name) {
    let i, ext
    for (i in vendorPrefixes) {
      ext = gl.getExtension(vendorPrefixes[i] + name)
      if (ext) {
        return ext
      }
    }
    return null
  },

  createSolidTexture: function (gl, color) {
    const data = new Uint8Array(color)
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    return texture
  },

  loadTexture: function (gl, src, callback) {
    const texture = gl.createTexture()
    textureLoader(gl, src, texture, callback)
    return texture
  },

  /**
   * Displays the given texture in a quad onscreen
   * This is not intended to be a high performance function, it's primarily for debugging.
   */
  drawTexturedQuad: function (gl, texture, x, y, width, height) {
    if (!quadShader) {
      // Set up the verticies and indices
      const quadVerts = [
        -1, 1, 0, 1,
        -1, -1, 0, 0,
        1, 1, 1, 1,

        -1, -1, 0, 0,
        1, -1, 1, 0,
        1, 1, 1, 1
      ]

      quadVertBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVertBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadVerts), gl.STATIC_DRAW)
      quadShader = this.createProgram(gl, quadVS, quadFS)
    }

    // This is a terrible way to do this, use a transform matrix instead
    gl.viewport(x, y, width, height)

    gl.disable(gl.DEPTH_TEST)

    gl.useProgram(quadShader.program)

    gl.bindBuffer(gl.ARRAY_BUFFER, quadVertBuffer)

    gl.enableVertexAttribArray(quadShader.attribute.position)
    gl.enableVertexAttribArray(quadShader.attribute.texture)
    gl.vertexAttribPointer(quadShader.attribute.position, 2, gl.FLOAT, false, 16, 0)
    gl.vertexAttribPointer(quadShader.attribute.texture, 2, gl.FLOAT, false, 16, 8)

    gl.activeTexture(gl.TEXTURE0)
    gl.uniform1i(quadShader.uniform.diffuse, 0)
    gl.bindTexture(gl.TEXTURE_2D, texture)

    gl.drawArrays(gl.TRIANGLES, 0, 6)

    gl.enable(gl.DEPTH_TEST)
    // gl.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
  },

  getQueryVariable: function (name) {
    const query = window.location.search.substring(1)
    const vars = query.split('&')
    for (let i = 0; i < vars.length; i++) {
      const pair = vars[i].split('=')
      if (pair[0] == name) {
        return unescape(pair[1])
      }
    }
    return null
  }
}
