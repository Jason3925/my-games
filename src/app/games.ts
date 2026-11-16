export type GameMeta = {
  id: string
  title: string
  cover: string
  entry: string
  description?: string
}

export type GamesManifest = {
  games: GameMeta[]
}

export async function loadGamesManifest(
  url = '/games.json',
): Promise<GamesManifest> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`failed to load ${url}: ${res.status}`)
  }
  const data = (await res.json()) as GamesManifest
  if (!data || !Array.isArray(data.games)) {
    throw new Error('invalid games.json')
  }
  return data
}
