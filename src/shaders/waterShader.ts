const WATER_MAP_DISTORT_GLSL = /* glsl */ `
vec2 distortMapCoord(vec2 xz, float strength, float speed, float time, float phaseId) {
  if (strength < 0.00001) return xz;
  float amp = strength * 0.4;
  float t = time * max(speed, 0.0);
  vec2 q = xz * 0.065 + vec2(t * 0.36, t * 0.28);
  float seed = uWaveSeed + phaseId * 17.3;
  return xz + vec2(
    sin(q.y * 2.15 + seed) + cos(q.x * 1.62 + phaseId),
    cos(q.x * 1.95 + seed * 0.31) + sin(q.y * 2.38 + phaseId * 0.73)
  ) * amp;
}
`

const WATER_WAVE_ELEVATION_GLSL = /* glsl */ `
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

vec2 waveSampleCoord(vec2 xz) {
  return xz * max(uWaveScale, 0.0001);
}

float sampleElevation(vec2 xz) {
  vec2 baseWarp = distortMapCoord(xz, uDisplacementDistortion, uDisplacementDistortionSpeed, uTime, 0.0);
  vec2 p = waveSampleCoord(baseWarp);
  float base;
  if (uStyle < 0.5) base = waveCalm(p);
  else if (uStyle < 1.5) base = waveChoppy(p);
  else base = waveRipples(p);

  vec2 detailWarp = distortMapCoord(xz, uDetailDistortion, uDetailDistortionSpeed, uTime, 20.0);
  vec2 pDetail = waveSampleCoord(detailWarp);
  return base + sampleDetail(pDetail) + sampleEdgeRippleElevation(xz);
}
`

const WATER_EDGE_RIPPLE_GLSL = /* glsl */ `
#define WATER_EDGE_MAX 64
#define WATER_EDGE_COORDS_MAX 128

uniform float uTerrainEdgeVertexCount;
uniform float uTerrainEdgeCoords[WATER_EDGE_COORDS_MAX];
uniform float uEdgeRippleEnabled;
uniform float uEdgeRippleStrength;
uniform float uEdgeRippleSpeed;
uniform float uEdgeRippleWaveScale;
uniform float uEdgeRippleFalloff;
uniform float uEdgeRippleMaxDist;
uniform float uEdgeRippleDisplacement;
uniform float uEdgeRippleNormal;
uniform float uEdgeRippleSoftness;
uniform float uEdgeRippleTime;
uniform float uShorelineFadeDistance;
uniform float uShorelineFadeStrength;

vec2 terrainEdgeVertex(int index) {
  int base = index * 2;
  return vec2(uTerrainEdgeCoords[base], uTerrainEdgeCoords[base + 1]);
}

void terrainEdgeDistanceGrad(vec2 p, out float dist, out vec2 outward) {
  dist = 1e9;
  outward = vec2(0.0, 1.0);

  for (int i = 0; i < WATER_EDGE_MAX; i++) {
    if (float(i) >= uTerrainEdgeVertexCount) break;
    int j = i + 1;
    if (float(j) >= uTerrainEdgeVertexCount) j = 0;
    vec2 a = terrainEdgeVertex(i);
    vec2 b = terrainEdgeVertex(j);
    vec2 ab = b - a;
    float abLen2 = dot(ab, ab);
    vec2 closest;
    if (abLen2 < 1e-6) {
      closest = a;
    } else {
      float t = clamp(dot(p - a, ab) / abLen2, 0.0, 1.0);
      closest = a + ab * t;
    }
    vec2 diff = p - closest;
    float segDist = length(diff);
    if (segDist < dist) {
      dist = segDist;
      if (segDist > 1e-4) {
        outward = diff / segDist;
      } else {
        vec2 edgeNormal = vec2(-ab.y, ab.x);
        float edgeLen = length(edgeNormal);
        outward = edgeLen > 1e-4 ? edgeNormal / edgeLen : vec2(0.0, 1.0);
      }
    }
  }
}

float edgeRippleEnvelope(float dist) {
  if (dist > uEdgeRippleMaxDist) return 0.0;
  float fade = 1.0 - smoothstep(uEdgeRippleMaxDist * 0.82, uEdgeRippleMaxDist, dist);
  return exp(-dist * max(uEdgeRippleFalloff, 0.0001)) * fade;
}

float softenRipplePeaks(float wave, float soft) {
  if (soft < 0.001) return wave;
  float exponent = 1.0 + soft * 2.8;
  return sign(wave) * pow(clamp(abs(wave), 0.0, 1.0), exponent);
}

float softenRipplePeaksDeriv(float wave, float cosPhase, float soft) {
  if (soft < 0.001) return cosPhase;
  float a = max(abs(wave), 1e-5);
  float exponent = 1.0 + soft * 2.8;
  return sign(wave) * exponent * pow(a, exponent - 1.0) * cosPhase;
}

float edgeRippleWave(float phase) {
  float s = sin(phase);
  return softenRipplePeaks(s, clamp(uEdgeRippleSoftness, 0.0, 1.0));
}

float edgeRippleWaveDerivative(float phase) {
  float s = sin(phase);
  float c = cos(phase);
  return softenRipplePeaksDeriv(s, c, clamp(uEdgeRippleSoftness, 0.0, 1.0));
}

float shorelineFadeAlpha(vec2 xz) {
  if (uShorelineFadeDistance < 0.001 || uTerrainEdgeVertexCount < 3.0) return 1.0;
  float dist;
  vec2 outward;
  terrainEdgeDistanceGrad(xz, dist, outward);
  float fade = smoothstep(0.0, uShorelineFadeDistance, dist);
  return mix(1.0, fade, clamp(uShorelineFadeStrength, 0.0, 1.0));
}

float sampleEdgeRippleElevation(vec2 xz) {
  if (uEdgeRippleEnabled < 0.5 || uEdgeRippleDisplacement < 0.001 || uTerrainEdgeVertexCount < 3.0) {
    return 0.0;
  }

  float dist;
  vec2 outward;
  terrainEdgeDistanceGrad(xz, dist, outward);

  float env = edgeRippleEnvelope(dist);
  if (env < 0.001) return 0.0;

  float phase = dist * uEdgeRippleWaveScale * 6.28318 - uEdgeRippleTime * uEdgeRippleSpeed;
  return edgeRippleWave(phase) * uEdgeRippleStrength * uEdgeRippleDisplacement * env;
}

vec2 sampleEdgeRippleGradXZ(vec2 xz) {
  if (uEdgeRippleEnabled < 0.5 || uEdgeRippleNormal < 0.001 || uTerrainEdgeVertexCount < 3.0) {
    return vec2(0.0);
  }

  float dist;
  vec2 outward;
  terrainEdgeDistanceGrad(xz, dist, outward);

  float env = edgeRippleEnvelope(dist);
  if (env < 0.001) return vec2(0.0);

  float k = uEdgeRippleWaveScale * 6.28318;
  float phase = dist * k - uEdgeRippleTime * uEdgeRippleSpeed;
  float dHeight = edgeRippleWaveDerivative(phase) * k * uEdgeRippleStrength * uEdgeRippleNormal * env;
  return outward * dHeight;
}
`

const WATER_BASE_NORMAL_GLSL = /* glsl */ `
float baseHash11(float p) {
  return fract(sin(p * 127.1 + uWaveSeed + 53.17) * 43758.5453);
}

float baseRandPhase(float id) {
  return (baseHash11(id) - 0.5) * 6.28318 * uBaseNormalRandomness;
}

float baseRandFreq(float id) {
  return 1.0 + (baseHash11(id + 17.0) - 0.5) * 0.4 * uBaseNormalRandomness;
}

vec2 baseRandDir(vec2 dir, float id) {
  if (uBaseNormalRandomness < 0.001) return normalize(dir);
  float angle = baseRandPhase(id + 31.0) * 0.65;
  float c = cos(angle);
  float s = sin(angle);
  return vec2(dir.x * c - dir.y * s, dir.x * s + dir.y * c);
}

vec2 baseScaledCoord(vec2 xz) {
  float scale = max(uBaseNormalWaveScale, 0.0001);
  return vec2(
    xz.x * max(uBaseNormalStretchX, 0.0001) * scale,
    xz.y * max(uBaseNormalStretchZ, 0.0001) * scale
  );
}

vec2 baseWaveComponentGrad(vec2 xz, vec2 dir, float freq, float animSpeed, float weight, float id) {
  vec2 p = baseScaledCoord(xz);
  vec2 d = baseRandDir(dir, id);
  float f = freq * baseRandFreq(id);
  float phase = dot(p, d) * f + uBaseNormalTime * animSpeed * uBaseNormalSpeed + baseRandPhase(id);
  vec2 gradP = d * (cos(phase) * weight * f);
  gradP.x *= max(uBaseNormalStretchX, 0.0001) * max(uBaseNormalWaveScale, 0.0001);
  gradP.y *= max(uBaseNormalStretchZ, 0.0001) * max(uBaseNormalWaveScale, 0.0001);
  return gradP;
}

vec2 baseWaveRadialGrad(vec2 xz, float freq, float speed, float weight, float id) {
  vec2 p = baseScaledCoord(xz);
  float len = max(length(p), 0.0001);
  vec2 radial = p / len;
  float f = freq * baseRandFreq(id);
  float phase = len * f + uBaseNormalTime * speed * uBaseNormalSpeed + baseRandPhase(id);
  vec2 gradP = radial * (cos(phase) * weight * f);
  gradP.x *= max(uBaseNormalStretchX, 0.0001) * max(uBaseNormalWaveScale, 0.0001);
  gradP.y *= max(uBaseNormalStretchZ, 0.0001) * max(uBaseNormalWaveScale, 0.0001);
  return gradP;
}

vec2 baseWaveCalmGrad(vec2 xz) {
  return baseWaveComponentGrad(xz, vec2(1.0, 0.0), 0.08, 1.0, 0.55, 1.0)
       + baseWaveComponentGrad(xz, vec2(0.0, 1.0), 0.06, 0.85, 0.45, 2.0);
}

vec2 baseWaveChoppyGrad(vec2 xz) {
  return baseWaveComponentGrad(xz, vec2(1.0, 0.0), 0.16, 1.25, 0.38, 3.0)
       + baseWaveComponentGrad(xz, vec2(0.0, 1.0), 0.13, 0.95, 0.34, 4.0)
       + baseWaveComponentGrad(xz, vec2(0.707, 0.707), 0.21, 1.55, 0.28, 5.0);
}

vec2 baseWaveRipplesGrad(vec2 xz) {
  return baseWaveRadialGrad(xz, 0.22, -2.1, 0.62, 6.0)
       + baseWaveComponentGrad(xz, vec2(1.0, 0.0), 0.34, 1.75, 0.22, 7.0)
       + baseWaveComponentGrad(xz, vec2(0.0, 1.0), 0.29, -1.35, 0.16, 8.0);
}

vec2 sampleBaseNormalGradXZ(vec2 xz) {
  vec2 warped = distortMapCoord(
    xz,
    uBaseNormalDistortion,
    uBaseNormalDistortionSpeed,
    uBaseNormalTime,
    5.0
  );
  if (uBaseNormalStyle < 0.5) return baseWaveCalmGrad(warped);
  if (uBaseNormalStyle < 1.5) return baseWaveChoppyGrad(warped);
  return baseWaveRipplesGrad(warped);
}

vec3 softLimitTilt(vec3 tilt, float limit) {
  float len = length(tilt);
  return tilt * (len / (len + limit));
}
`

const WATER_NORMAL_DETAIL_GLSL = /* glsl */ `
float normalHash11(float p) {
  return fract(sin(p * 127.1 + uWaveSeed + 91.17) * 43758.5453);
}

float normalLayerPhase(float id, float layerIndex, float randomness) {
  return (normalHash11(id + layerIndex * 41.7) - 0.5) * 6.28318 * randomness;
}

float normalLayerFreq(float id, float layerIndex, float randomness) {
  return 1.0 + (normalHash11(id + 17.0 + layerIndex * 41.7) - 0.5) * 0.5 * randomness;
}

vec2 normalLayerDir(vec2 dir, float id, float layerIndex, float randomness) {
  vec2 unit = normalize(dir);
  if (randomness < 0.001) return unit;
  float angle = normalLayerPhase(id + 31.0, layerIndex, randomness);
  float c = cos(angle);
  float s = sin(angle);
  return vec2(unit.x * c - unit.y * s, unit.x * s + unit.y * c);
}

vec2 normalLayerRippleGrad(
  vec2 xz,
  vec2 dir,
  float freq,
  float animSpeed,
  float weight,
  float componentId,
  float layerIndex,
  float waveScale,
  float stretchX,
  float stretchZ,
  float randomness,
  float layerSpeed,
  float layerStrength
) {
  if (layerStrength < 0.001 || waveScale < 0.0001) return vec2(0.0);

  float scale = max(waveScale, 0.0001);
  vec2 scaledXz = vec2(xz.x * max(stretchX, 0.0001), xz.y * max(stretchZ, 0.0001));
  vec2 p = scaledXz * scale;
  vec2 d = normalLayerDir(dir, componentId, layerIndex, randomness);
  float f = freq * normalLayerFreq(componentId, layerIndex, randomness);
  float phase = dot(p, d) * f
              + uNormalDetailTime * animSpeed * layerSpeed
              + normalLayerPhase(componentId, layerIndex, randomness);
  vec2 gradP = d * (cos(phase) * weight * f);
  return gradP * scale * layerStrength;
}

vec2 normalLayerGradXZ(
  vec2 xz,
  float layerIndex,
  float waveScale,
  float stretchX,
  float stretchZ,
  float randomness,
  float layerSpeed,
  float layerStrength,
  float distortion,
  float distortionSpeed
) {
  xz = distortMapCoord(xz, distortion, distortionSpeed, uNormalDetailTime, layerIndex + 30.0);
  float idBase = 20.0 + layerIndex * 10.0;
  return normalLayerRippleGrad(xz, vec2(1.0, 0.12), 0.28, 1.15, 0.55, idBase + 0.0, layerIndex, waveScale, stretchX, stretchZ, randomness, layerSpeed, layerStrength)
       + normalLayerRippleGrad(xz, vec2(0.1, 1.0), 0.24, 1.35, 0.5, idBase + 1.0, layerIndex, waveScale, stretchX, stretchZ, randomness, layerSpeed, layerStrength)
       + normalLayerRippleGrad(xz, vec2(0.82, 0.68), 0.38, 1.55, 0.42, idBase + 2.0, layerIndex, waveScale, stretchX, stretchZ, randomness, layerSpeed, layerStrength)
       + normalLayerRippleGrad(xz, vec2(-0.55, 0.88), 0.46, 1.75, 0.34, idBase + 3.0, layerIndex, waveScale, stretchX, stretchZ, randomness, layerSpeed, layerStrength);
}

vec2 sampleNormalDetailGradXZ(vec2 xz) {
  vec2 grad = vec2(0.0);
  float layerCount = max(uNormalLayerCount, 1.0);
  float layerShare = 1.0 / layerCount;

  if (uNormalLayerCount >= 1.0) {
    grad += normalLayerGradXZ(
      xz, 0.0,
      uNormalLayerWaveScale[0], uNormalLayerStretchX[0], uNormalLayerStretchZ[0],
      uNormalLayerRandomness[0], uNormalLayerSpeed[0], uNormalLayerStrength[0], uNormalLayerDistortion[0], uNormalLayerDistortionSpeed[0]
    ) * layerShare;
  }
  if (uNormalLayerCount >= 2.0) {
    grad += normalLayerGradXZ(
      xz, 1.0,
      uNormalLayerWaveScale[1], uNormalLayerStretchX[1], uNormalLayerStretchZ[1],
      uNormalLayerRandomness[1], uNormalLayerSpeed[1], uNormalLayerStrength[1], uNormalLayerDistortion[1], uNormalLayerDistortionSpeed[1]
    ) * layerShare;
  }
  if (uNormalLayerCount >= 3.0) {
    grad += normalLayerGradXZ(
      xz, 2.0,
      uNormalLayerWaveScale[2], uNormalLayerStretchX[2], uNormalLayerStretchZ[2],
      uNormalLayerRandomness[2], uNormalLayerSpeed[2], uNormalLayerStrength[2], uNormalLayerDistortion[2], uNormalLayerDistortionSpeed[2]
    ) * layerShare;
  }
  if (uNormalLayerCount >= 4.0) {
    grad += normalLayerGradXZ(
      xz, 3.0,
      uNormalLayerWaveScale[3], uNormalLayerStretchX[3], uNormalLayerStretchZ[3],
      uNormalLayerRandomness[3], uNormalLayerSpeed[3], uNormalLayerStrength[3], uNormalLayerDistortion[3], uNormalLayerDistortionSpeed[3]
    ) * layerShare;
  }
  return grad;
}

vec3 applyCombinedNormalTilt(vec3 meshNormal, vec2 xz) {
  vec2 baseGrad = sampleBaseNormalGradXZ(xz) * clamp(uBaseNormalStrength, 0.0, 1.0);
  vec2 detailGrad = sampleNormalDetailGradXZ(xz);
  vec2 edgeGrad = sampleEdgeRippleGradXZ(xz);
  float amp = uWaveHeight;

  // Base + detail normal layers first (shared soft limit).
  vec3 underlyingTilt = vec3(
    -(baseGrad.x * 5.5 + detailGrad.x * 4.5) * amp,
    0.0,
    (baseGrad.y * 5.5 + detailGrad.y * 4.5) * amp
  );
  underlyingTilt = softLimitTilt(underlyingTilt, 0.55);
  vec3 underlyingNormal = normalize(meshNormal + underlyingTilt);

  // Shoreline ripples applied on top so they are never drowned out by other layers.
  vec3 edgeTilt = vec3(-edgeGrad.x * 3.5 * amp, 0.0, edgeGrad.y * 3.5 * amp);
  edgeTilt = softLimitTilt(edgeTilt, 0.4);
  return normalize(underlyingNormal + edgeTilt);
}
`

const WATER_VERTEX_NORMAL_GLSL = /* glsl */ `
float displacementHeight(vec2 xy) {
  return sampleElevation(xy) * uWaveHeight;
}

vec3 displacedWorldPos(vec2 xy, float zBase) {
  float h = displacementHeight(xy);
  return (modelMatrix * vec4(xy.x, xy.y, zBase + h, 1.0)).xyz;
}

vec3 displacementNormalAt(vec2 xy, float zBase, float sampleRadius) {
  float eps = max(sampleRadius, 0.02);
  vec3 p0 = displacedWorldPos(xy, zBase);
  vec3 px = displacedWorldPos(xy + vec2(eps, 0.0), zBase);
  vec3 py = displacedWorldPos(xy + vec2(0.0, eps), zBase);
  return normalize(cross(py - p0, px - p0));
}

vec3 computeVertexBaseNormal(vec2 xy, float zBase) {
  float radius = max(uNormalMapScale, 0.05);
  vec3 baseNormal = displacementNormalAt(xy, zBase, radius);
  if (radius > 0.08) {
    baseNormal += displacementNormalAt(xy + vec2(radius, 0.0), zBase, radius);
    baseNormal += displacementNormalAt(xy - vec2(radius, 0.0), zBase, radius);
    baseNormal += displacementNormalAt(xy + vec2(0.0, radius), zBase, radius);
    baseNormal += displacementNormalAt(xy - vec2(0.0, radius), zBase, radius);
    baseNormal = normalize(baseNormal);
  }
  return baseNormal;
}
`

export const waterVertexShader = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveIntensity;
uniform float uStyle;
uniform float uWaveRandomness;
uniform float uWaveSeed;
uniform float uWaveScale;
uniform float uDisplacementDistortion;
uniform float uDisplacementDistortionSpeed;
uniform float uDetailDistortion;
uniform float uDetailDistortionSpeed;
uniform float uDetailLayers;
uniform float uDetailScale;
uniform float uDetailStrength;
uniform float uNormalMapScale;

varying vec3 vWorldPos;
varying vec3 vBaseNormal;
varying float vElevation;
varying float vFogDepth;
varying vec2 vLocalPos;

${WATER_MAP_DISTORT_GLSL}
${WATER_EDGE_RIPPLE_GLSL}
${WATER_WAVE_ELEVATION_GLSL}
${WATER_VERTEX_NORMAL_GLSL}

void main() {
  vLocalPos = position.xy;
  float zBase = position.z;
  float elevation = displacementHeight(vLocalPos);

  vBaseNormal = computeVertexBaseNormal(vLocalPos, zBase);
  vElevation = elevation;

  vec3 pos = vec3(vLocalPos.x, vLocalPos.y, zBase + elevation);
  vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPosition.xyz;
  vec4 mvPosition = viewMatrix * worldPosition;
  vFogDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}
`

export const waterFragmentShader = /* glsl */ `
uniform float uNormalMapStrength;
uniform float uBaseNormalWaveScale;
uniform float uBaseNormalStretchX;
uniform float uBaseNormalStretchZ;
uniform float uBaseNormalRandomness;
uniform float uBaseNormalSpeed;
uniform float uBaseNormalStrength;
uniform float uBaseNormalStyle;
uniform float uBaseNormalDistortion;
uniform float uBaseNormalDistortionSpeed;
uniform float uBaseNormalTime;
uniform float uNormalLayerCount;
uniform float uNormalLayerWaveScale[4];
uniform float uNormalLayerStretchX[4];
uniform float uNormalLayerStretchZ[4];
uniform float uNormalLayerRandomness[4];
uniform float uNormalLayerSpeed[4];
uniform float uNormalLayerStrength[4];
uniform float uNormalLayerDistortion[4];
uniform float uNormalLayerDistortionSpeed[4];
uniform float uWaveHeight;
uniform float uWaveSeed;
uniform float uNormalDetailTime;
uniform vec3 uBaseColor;
uniform vec3 uNormalHighlightColor;
uniform vec3 uNormalShadowColor;
uniform float uNormalColorScale;
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
varying vec3 vBaseNormal;
varying float vElevation;
varying float vFogDepth;
varying vec2 vLocalPos;

${WATER_MAP_DISTORT_GLSL}
${WATER_EDGE_RIPPLE_GLSL}
${WATER_BASE_NORMAL_GLSL}
${WATER_NORMAL_DETAIL_GLSL}

void main() {
  vec3 meshNormal = normalize(vBaseNormal);
  vec3 waveNormal = applyCombinedNormalTilt(meshNormal, vLocalPos);
  vec3 flatNormal = vec3(0.0, 1.0, 0.0);
  float litMix = clamp(uNormalMapStrength, 0.0, 1.0);
  vec3 normal = normalize(mix(flatNormal, waveNormal, litMix));

  float roughness = clamp(uRoughness, 0.0, 1.0);
  float metalness = clamp(uMetalness, 0.0, 1.0);
  float smoothness = 1.0 - roughness;

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float ndv = max(dot(normal, viewDir), 0.0);
  // Grazing-angle fresnel — smooth/metallic water reflects more at shallow view angles.
  float fresnel = pow(1.0 - ndv, mix(2.5, 5.0, smoothness));

  vec3 baseColor = mix(uBaseColor * 0.55, uBaseColor * 1.25, fresnel * 0.45 + 0.25 + vElevation * 0.35);
  baseColor = mix(baseColor, baseColor * (0.55 + smoothness * 0.25), metalness * 0.65);

  vec3 halfVector = normalize(uSunDirection + viewDir);
  float specPower = mix(4.0, 512.0, smoothness * smoothness);
  float ndh = max(dot(normal, halfVector), 0.0);
  float spec = pow(ndh, specPower);
  float specAa = mix(0.2, 0.75, roughness);
  spec *= clamp(1.0 - fwidth(ndh) * specPower * specAa, 0.0, 1.0);
  spec *= clamp(1.0 - length(fwidth(normal)) * specPower * mix(0.15, 0.45, roughness), 0.0, 1.0);

  float colorScale = clamp(uNormalColorScale, 0.0, 3.0);
  float sunNd = dot(normal, uSunDirection);
  float normalShade = clamp(sunNd * 0.5 + 0.5, 0.0, 1.0);
  vec3 normalLitColor = mix(uNormalShadowColor, uNormalHighlightColor, normalShade);
  float normalContrast = mix(0.25, 1.0, smoothness);
  vec3 bodyColor = baseColor + (normalLitColor - baseColor) * litMix * colorScale * normalContrast;

  float specIntensity = mix(0.05, 1.0, metalness) * mix(0.35, 1.0, smoothness);
  vec3 specColor = mix(uNormalHighlightColor, vec3(1.0), metalness * 0.75);
  vec3 specHighlight = specColor * spec * specIntensity * colorScale * mix(0.35, 1.0, litMix);

  float fresnelStrength = mix(0.04, 0.42, metalness * 0.55 + smoothness * 0.45);
  vec3 fresnelTint = mix(uBaseColor, uNormalHighlightColor, metalness);
  vec3 finalColor = bodyColor + specHighlight + fresnel * fresnelStrength * fresnelTint;

  if (uFogEnabled > 0.5) {
    float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
    finalColor = mix(finalColor, uFogColor, fogFactor);
  }

  float edgeDist = length(vLocalPos) / uPlaneHalfSize;
  float edgeAlpha = uEdgeFade > 0.001
    ? 1.0 - smoothstep(1.0 - uEdgeFade, 1.0, edgeDist)
    : 1.0;
  float shoreAlpha = shorelineFadeAlpha(vLocalPos);

  gl_FragColor = vec4(finalColor, uOpacity * edgeAlpha * shoreAlpha);
}
`
