/* E-gate — Liquid Chrome animated background
   A WebGL fragment shader that renders flowing, 3D-ish metallic waves
   with a glowing ember seam, echoing the brand image.
   Falls back silently to the static CSS background if WebGL is unavailable. */
(function () {
  'use strict';

  // Respect reduced motion
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canvas = document.createElement('canvas');
  canvas.id = 'chrome-bg';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;display:block;pointer-events:none;';

  // Keep the animated canvas visible while all page content stays above it.
  // Earlier versions used a negative z-index, which could place the canvas behind
  // the opaque body background on generated download gates.
  var style = document.createElement('style');
  style.textContent = [
    'html,body{min-height:100%;background:#000!important;}',
    'body{isolation:isolate;}',
    'body::before{z-index:1!important;}',
    'body::after{z-index:2!important;}',
    'body>*:not(#chrome-bg){position:relative;z-index:3;}'
  ].join('');
  if (document.head) document.head.appendChild(style);

  // Insert as first element so everything renders on top of the background
  if (document.body) document.body.insertBefore(canvas, document.body.firstChild);

  var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) { canvas.style.display = 'none'; return; } // CSS fallback stays

  var vert = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';

  // Fragment shader: domain-warped flowing metal + ember seam + spec highlights
  var frag = [
    'precision highp float;',
    'uniform vec2 r;',     // resolution
    'uniform float t;',    // time
    '',
    // hash + value noise
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
    'float a=h(i),b=h(i+vec2(1.0,0.0)),c=h(i+vec2(0.0,1.0)),d=h(i+vec2(1.0,1.0));',
    'return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
    'float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<6;i++){v+=a*n(p);p*=2.02;a*=0.5;}return v;}',
    '',
    'void main(){',
    '  vec2 uv=(gl_FragCoord.xy-0.5*r)/r.y;',
    '  float tt=t*0.05;',
    // domain warp -> liquid flow
    '  vec2 q=vec2(fbm(uv*1.5+vec2(0.0,tt)),fbm(uv*1.5+vec2(5.2,1.3-tt)));',
    '  vec2 w=vec2(fbm(uv*1.5+4.0*q+vec2(1.7,9.2)+tt),fbm(uv*1.5+4.0*q+vec2(8.3,2.8)-tt));',
    '  float f=fbm(uv*1.8+4.0*w);',
    // metallic banding from the warped field (chrome ramp)
    '  float band=sin((w.x*3.0+w.y*2.0+f*4.0)*3.1415);',
    '  float metal=smoothstep(-1.0,1.0,band);',
    // base chrome color: brighter dark steel -> mirror silver
    '  vec3 dark=vec3(0.055,0.058,0.070);',
    '  vec3 steel=vec3(0.30,0.32,0.38);',
    '  vec3 silver=vec3(0.92,0.94,0.99);',
    '  vec3 col=mix(dark,steel,metal);',
    // extra reflected chrome colour: cool blue/violet with warm silver edges
    '  float refl=0.5+0.5*sin(uv.x*5.5-uv.y*3.2+f*7.5+t*0.10);',
    '  vec3 blue=vec3(0.22,0.34,0.58);',
    '  vec3 violet=vec3(0.42,0.32,0.62);',
    '  vec3 warm=vec3(0.95,0.78,0.58);',
    '  vec3 tint=mix(blue,violet,smoothstep(0.15,0.85,refl));',
    '  tint=mix(tint,warm,pow(max(band,0.0),2.0)*0.35);',
    '  col=mix(col,tint,0.20+0.18*metal);',
    // sharp specular glints where the field folds
    '  float spec=pow(smoothstep(0.48,0.92,f+0.30*band),4.2);',
    '  float line=pow(abs(sin((w.x-w.y+f)*18.0)),22.0);',
    '  col=mix(col,silver,clamp(spec*1.15+line*0.45,0.0,1.0));',
    // lighter vignette: keeps text readable but lets more chrome shine through
    '  float vig=smoothstep(1.32,0.15,length(uv));',
    '  col*=mix(0.58,1.12,vig);',
    // ── Ember seam: a glowing diagonal line that drifts & pulses ──
    '  float ang=-0.42;', // diagonal tilt (radians)
    '  vec2 ruv=mat2(cos(ang),-sin(ang),sin(ang),cos(ang))*uv;',
    '  float drift=0.18*sin(t*0.15)+0.22;',
    '  float seam=abs(ruv.x-drift);',
    '  float wob=0.012+0.010*sin(ruv.y*6.0+t*0.6);',
    '  float glow=smoothstep(wob*9.0,0.0,seam);',
    '  float core=smoothstep(wob,0.0,seam);',
    '  float pulse=0.75+0.25*sin(t*1.2);',
    '  vec3 ember=vec3(1.0,0.23,0.0);',
    '  vec3 emberHot=vec3(1.0,0.55,0.18);',
    '  col+=ember*glow*0.35*pulse;',
    '  col+=emberHot*core*1.05*pulse;',
    // subtle ember bounce light on nearby metal
    '  col+=ember*spec*glow*0.35;',
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { return null; }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, vert);
  var fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) { canvas.style.display = 'none'; return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.style.display = 'none'; return; }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uR = gl.getUniformLocation(prog, 'r');
  var uT = gl.getUniformLocation(prog, 't');

  var dpr = Math.min(window.devicePixelRatio || 1, 1.5); // cap for perf
  function resize() {
    var w = Math.floor(window.innerWidth * dpr);
    var h = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  window.addEventListener('resize', resize);
  resize();

  var start = performance.now();

  if (reduce) {
    // Render a single static frame, no animation loop
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, 12.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return;
  }

  var running = true;
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) loop();
  });

  function loop() {
    if (!running) return;
    var now = (performance.now() - start) / 1000;
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, now);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(loop);
  }
  loop();
})();
