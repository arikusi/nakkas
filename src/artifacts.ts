/**
 * In-memory artifact store for rendered output.
 *
 * render_svg stores its result here and returns a short id instead of the
 * full SVG text. preview and save accept that id, so the SVG never has to
 * travel back through the model's context window. Artifacts live for the
 * server process lifetime only; the store is capped and evicts oldest first.
 */

const MAX_ARTIFACTS = 32;

interface Artifact {
  svg: string;
  createdAt: number;
}

const store = new Map<string, Artifact>();
let counter = 0;

/** Store rendered SVG, return its artifact id (e.g. "art-1"). */
export function storeArtifact(svg: string): string {
  counter += 1;
  const id = `art-${counter}`;
  store.set(id, { svg, createdAt: Date.now() });
  while (store.size > MAX_ARTIFACTS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
  return id;
}

/** Look up a stored artifact's SVG by id. */
export function getArtifact(id: string): string | undefined {
  return store.get(id)?.svg;
}

/** Ids currently held in the store, oldest first. */
export function listArtifactIds(): string[] {
  return [...store.keys()];
}

/** Test helper: empty the store and reset the id counter. */
export function clearArtifacts(): void {
  store.clear();
  counter = 0;
}
