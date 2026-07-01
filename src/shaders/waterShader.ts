export const waterVertexShader = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveIntensity;
uniform float uStyle;
uniform float uWaveRandomness;
uniform float uWaveSeed;
uniform float uWaveScale;
uniform float uDetailLayers;
uniform float uDetailScale;
uniform float uDetailStrength;

varying vec3 vWorldPos;
varying float vElevation;
varying float vFogDepth;
varying vec2 vLocalPos;

float hash11(float p) {
  return fract(sin(p * 127.1 + uWaveSeed) * 43758.5453);
}

float randPhase(float id) {
  return (hash11(id) - 0.5) * 6.28318 * uWaveRandomness;
}

float randFreq(float id) {
  return 1.0 + (hash11(id + 17.0) - 0.5) * 0.4 * uWaveRandomness;
}

vec2 randDir(vec2 dir, float id) {
  if (uWaveRandomness < 0.001) return dir;
  float angle = randPhase(id + 31.0) * 0.65;
  float c = cos(angle);
  float s = sin(angle);
  return vec2(dir.x * c - dir.y * s, dir.x * s + dir.y * c);
}

float waveComponent(vec2 p, vec2 dir, float freq, float speed, float weight, float id) {
  vec2 d = randDir(normalize(dir), id);
  float f = freq * uWaveIntensity * randFreq(id);
  return sin(dot(p, d) * f + uTime * speed + randPhase(id)) * weight;
}

float waveCalm(vec2 p) {
  return waveComponent(p, vec2(1.0, 0.0), 0.08, 1.0, 0.55, 1.0)
       + waveComponent(p, vec2(0.0, 1.0), 0.06, 0.85, 0.45, 2.0);
}

float waveChoppy(vec2 p) {
  return waveComponent(p, vec2(1.0, 0.0), 0.16, 1.25, 0.38, 3.0)
       + waveComponent(p, vec2(0.0, 1.0), 0.13, 0.95, 0.34, 4.0)
       + waveComponent(p, vec2(0.707, 0.707), 0.21, 1.55, 0.28, 5.0);
}

float waveRadial(vec2 p, float freq, float speed, float weight, float id) {
  float f = freq * uWaveIntensity * randFreq(id);
  return sin(length(p) * f + uTime * speed + randPhase(id)) * weight;
}

float waveRipples(vec2 p) {
  return waveRadial(p, 0.22, -2.1, 0.62, 6.0)
       + waveComponent(p, vec2(1.0, 0.0), 0.34, 1.75, 0.22, 7.0)
       + waveComponent(p, vec2(0.0, 1.0), 0.29, -1.35, 0.16, 8.0);
}

float sampleDetail(vec2 p) {
  float strength = uDetailStrength * step(0.5, uDetailLayers);
  if (strength < 0.001) return 0.0;

  float scale = max(uDetailScale, 1.0);
  float detail = waveComponent(p, vec2(1.0, 0.15), 0.12 * scale, 1.7, 0.5, 10.0)
               + waveComponent(p, vec2(0.12, 1.0), 0.14 * scale, 1.4, 0.5, 11.0);

  if (uDetailLayers > 1.5) {
    detail += waveComponent(p, vec2(0.85, 0.85), 0.28 * scale, 2.2, 0.35, 12.0)
            + waveComponent(p, vec2(-0.55, 0.9), 0.32 * scale, 2.0, 0.35, 13.0);
  }

  if (uDetailLayers > 2.5) {
    detail += waveComponent(p, vec2(0.4, -0.9), 0.52 * scale, 2.8, 0.28, 14.0)
            + waveComponent(p, vec2(-0.95, 0.35), 0.48 * scale, 2.6, 0.28, 15.0);
  }

  if (uDetailLayers > 3.5) {
    detail += waveComponent(p, vec2(0.15, 0.95), 0.72 * scale, 3.4, 0.22, 16.0)
            + waveComponent(p, vec2(-0.2, -0.95), 0.68 * scale, 3.2, 0.22, 17.0);
  }

  return detail * strength;
}

float sampleElevation(vec2 xz) {
  vec2 p = xz * max(uWaveScale, 0.1);
  float base;
  if (uStyle < 0.5) base = waveCalm(p);
  else if (uStyle < 1.5) base = waveChoppy(p);
  else base = waveRipples(p);

  return base + sampleDetail(p);
}

void main() {
  vec3 pos = position;
  float elevation = sampleElevation(pos.xy) * uWaveHeight;
  pos.z += elevation;

  vElevation = elevation;
  vLocalPos = pos.xy;
  vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPosition.xyz;
  vec4 mvPosition = viewMatrix * worldPosition;
  vFogDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}
`

export const waterFragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uMetalness;
uniform float uRoughness;
uniform vec3 uSunDirection;
uniform float uFogEnabled;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uPlaneHalfSize;
uniform float uEdgeFade;

varying vec3 vWorldPos;
varying float vElevation;
varying float vFogDepth;
varying vec2 vLocalPos;

void main() {
  vec3 dx = dFdx(vWorldPos);
  vec3 dy = dFdy(vWorldPos);
  vec3 normal = normalize(cross(dx, dy));

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float ndv = max(dot(normal, viewDir), 0.0);
  float fresnel = ndv * ndv * ndv;

  vec3 baseColor = mix(uColor * 0.55, uColor * 1.25, fresnel * 0.45 + 0.25 + vElevation * 0.35);

  vec3 halfVector = normalize(uSunDirection + viewDir);
  float specPower = mix(24.0, 128.0, 1.0 - uRoughness);
  float spec = pow(max(dot(normal, halfVector), 0.0), specPower);

  vec3 finalColor = baseColor + vec3(spec * uMetalness * 0.35) + fresnel * 0.12;

  if (uFogEnabled > 0.5) {
    float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
    finalColor = mix(finalColor, uFogColor, fogFactor);
  }

  float edgeDist = max(abs(vLocalPos.x), abs(vLocalPos.y)) / uPlaneHalfSize;
  float edgeAlpha = uEdgeFade > 0.001
    ? 1.0 - smoothstep(1.0 - uEdgeFade, 1.0, edgeDist)
    : 1.0;

  gl_FragColor = vec4(finalColor, uOpacity * edgeAlpha);
}
`
