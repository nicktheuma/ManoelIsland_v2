import type { GeoBounds } from './geo'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

export type OsmNode = { id: number; lat: number; lon: number; tags?: Record<string, string> }
export type OsmWay = { id: number; nodes: number[]; tags?: Record<string, string> }

export type OverpassResponse = {
  elements: Array<
    | { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string> }
    | { type: 'way'; id: number; nodes: number[]; tags?: Record<string, string> }
  >
}

export function buildSiteMapOverpassQuery(bounds: GeoBounds): string {
  const { south, west, north, east } = bounds
  return `
[out:json][timeout:45];
(
  way["building"](${south},${west},${north},${east});
  way["building:part"](${south},${west},${north},${east});
  way["highway"](${south},${west},${north},${east});
  way["natural"="wood"](${south},${west},${north},${east});
  way["natural"="water"](${south},${west},${north},${east});
  way["waterway"](${south},${west},${north},${east});
  way["leisure"="park"](${south},${west},${north},${east});
  way["landuse"="grass"](${south},${west},${north},${east});
  way["landuse"="forest"](${south},${west},${north},${east});
  node["natural"="tree"](${south},${west},${north},${east});
  node["natural"="shrub"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;
`.trim()
}

export async function fetchOverpass(query: string): Promise<OverpassResponse> {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  })

  if (!response.ok) {
    throw new Error(`OpenStreetMap query failed (${response.status}). Try again in a moment.`)
  }

  return response.json() as Promise<OverpassResponse>
}

export function parseOverpassElements(response: OverpassResponse): {
  nodes: Map<number, OsmNode>
  ways: OsmWay[]
} {
  const nodes = new Map<number, OsmNode>()
  const ways: OsmWay[] = []

  for (const element of response.elements) {
    if (element.type === 'node') {
      nodes.set(element.id, {
        id: element.id,
        lat: element.lat,
        lon: element.lon,
        tags: element.tags,
      })
    } else if (element.type === 'way') {
      ways.push({ id: element.id, nodes: element.nodes, tags: element.tags })
    }
  }

  return { nodes, ways }
}

export function wayLatLngs(way: OsmWay, nodes: Map<number, OsmNode>): [number, number][] {
  const coords: [number, number][] = []
  for (const nodeId of way.nodes) {
    const node = nodes.get(nodeId)
    if (node) coords.push([node.lat, node.lon])
  }
  return coords
}
