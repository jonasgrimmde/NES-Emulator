(() => {
  const defaults = {
    enabled: false,
    scanlineIntensity: 0.15,
    scanlineCount: 400,
    brightness: 1.1,
    contrast: 1.05,
    saturation: 1.1,
    bloomIntensity: 0.2,
    bloomThreshold: 0.5,
    rgbShift: 0,
    adaptiveIntensity: 0.5,
    vignetteStrength: 0.3,
    curvature: 0.15,
    flickerStrength: 0.01,
  };

  const fragmentShader = `
    precision mediump float;
    uniform sampler2D tDiffuse;
    uniform float scanlineIntensity, scanlineCount, time, yOffset, brightness, contrast, saturation;
    uniform float bloomIntensity, bloomThreshold, rgbShift, adaptiveIntensity, vignetteStrength, curvature, flickerStrength;
    varying vec2 vUv;
    const float PI = 3.14159265;
    const vec3 LUMA = vec3(0.299, 0.587, 0.114);
    vec2 curveRemapUV(vec2 uv, float c) {
      vec2 coords = uv * 2.0 - 1.0;
      coords = coords * (1.0 + dot(coords, coords) * c * 0.25);
      return coords * 0.5 + 0.5;
    }
    float vignetteApprox(vec2 uv, float strength) {
      vec2 vigCoord = uv * 2.0 - 1.0;
      float dist = max(abs(vigCoord.x), abs(vigCoord.y));
      return 1.0 - dist * dist * strength;
    }
    void main() {
      vec2 uv = vUv;
      if (curvature > 0.001) {
        uv = curveRemapUV(uv, curvature);
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0); return; }
      }
      vec4 pixel = texture2D(tDiffuse, uv);
      if (bloomIntensity > 0.001) {
        float lum = dot(pixel.rgb, LUMA);
        if (lum > bloomThreshold * 0.5) {
          vec4 bloom = (pixel * 0.4 + texture2D(tDiffuse, uv + vec2(0.005, 0.0)) * 0.15 + texture2D(tDiffuse, uv - vec2(0.005, 0.0)) * 0.15 + texture2D(tDiffuse, uv + vec2(0.0, 0.005)) * 0.15 + texture2D(tDiffuse, uv - vec2(0.0, 0.005)) * 0.15);
          pixel.rgb += bloom.rgb * bloomIntensity * max(0.0, (dot(bloom.rgb, LUMA) - bloomThreshold) * 1.5);
        }
      }
      if (rgbShift > 0.005) {
        float shift = rgbShift * 0.005;
        pixel.r += texture2D(tDiffuse, vec2(uv.x + shift, uv.y)).r * 0.08;
        pixel.b += texture2D(tDiffuse, vec2(uv.x - shift, uv.y)).b * 0.08;
      }
      pixel.rgb *= brightness;
      float luminance = dot(pixel.rgb, LUMA);
      pixel.rgb = (pixel.rgb - 0.5) * contrast + 0.5;
      pixel.rgb = mix(vec3(luminance), pixel.rgb, saturation);
      float mask = 1.0;
      if (scanlineIntensity > 0.001) {
        float scanlinePattern = abs(sin((uv.y + yOffset) * scanlineCount * PI));
        float adaptive = 1.0 - (sin(uv.y * 30.0) * 0.5 + 0.5) * adaptiveIntensity * 0.2;
        mask *= 1.0 - scanlinePattern * scanlineIntensity * adaptive;
      }
      mask *= 1.0 + sin(time * 110.0) * flickerStrength;
      mask *= vignetteApprox(uv, vignetteStrength);
      gl_FragColor = vec4(pixel.rgb * mask, pixel.a);
    }`;

  class CRTFilter {
    constructor(container) {
      this.container = container;
      this.params = { ...defaults };
      this.canvas = document.createElement("canvas");
      this.canvas.className = "crt-output";
      this.gl = this.canvas.getContext("webgl", { alpha: false });
      if (!this.gl) throw new Error("WebGL not supported");
      container.append(this.canvas);
      this.init();
    }
    init() {
      const gl = this.gl;
      const program = this.program = createProgram(gl, `
        attribute vec2 position; varying vec2 vUv;
        void main(){ vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
      `, fragmentShader);
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
      const pos = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.uniforms = {};
      Object.keys(defaults).forEach((key) => this.uniforms[key] = gl.getUniformLocation(program, key));
      this.uniforms.time = gl.getUniformLocation(program, "time");
      this.uniforms.yOffset = gl.getUniformLocation(program, "yOffset");
    }
    setParams(params) { this.params = { ...this.params, ...params }; }
    setEnabled(enabled) {
      this.params.enabled = Boolean(enabled);
      this.container.classList.toggle("crt-active", this.params.enabled);
    }
    render(source) {
      if (!this.params.enabled || !source || !source.width || !source.height) return;
      const gl = this.gl;
      if (gl.isContextLost && gl.isContextLost()) return;
      if (this.canvas.width !== source.width || this.canvas.height !== source.height) {
        this.canvas.width = source.width; this.canvas.height = source.height;
        gl.viewport(0, 0, source.width, source.height);
      }
      gl.useProgram(this.program);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      Object.entries(this.params).forEach(([key, value]) => {
        if (key !== "enabled" && this.uniforms[key]) gl.uniform1f(this.uniforms[key], Number(value));
      });
      gl.uniform1f(this.uniforms.time, performance.now() / 1000);
      gl.uniform1f(this.uniforms.yOffset, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  function createProgram(gl, vsSource, fsSource) {
    const vs = compile(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }
  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  window.CRTFilter = CRTFilter;
  window.CRT_DEFAULTS = defaults;
})();
