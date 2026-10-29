/**
 * analysis/laplacian — spectral geometry of the relation graph.
 *
 * The relation graph of a section (terms as vertices, weighted by how many cells
 * relate each pair) carries the combinatorial Laplacian L = D − W. From it,
 * exactly over ℤ: the deviation operator (Lf)(x) = Σ_y w(x,y)(f(x)−f(y)); the
 * harmonic judgment Lf = 0 (witness/obstruction, not a float threshold); the
 * component count as the zero-eigenvalue multiplicity (rank deficiency); the
 * characteristic polynomial; and the weighted spanning-tree count (Matrix-Tree).
 * Reflexive cells contribute nothing. Carrier-valued throughout.
 */
import { termCoincides } from "../../../predication.mjs";
import {} from "../section.mjs";
import { charPoly, count, determinant, fromInteger, fromNatural, intAdd, intIsZero, intMultiply, intNegate, intOne, intZero, isNegative, magnitude, monus, rank, ratAdd, ratIsZero, ratMultiply, ratZero, } from "./exact-number.mjs";
const sameTerm = (left, right) => termCoincides(left, right);
/** The relation graph of a bare list of predication CELLS — distinct subject/object terms as
 *  vertices, weighted by how many cells relate each pair. This is the part `relationGraph` actually
 *  needs: it reads only `cell.subject`/`cell.object`, never the charge or the fixed-point reading's
 *  order/bound. Exposing it lets ANY holder of cells (a faculty's held section, a membrane) read the
 *  Laplacian geometry without first materializing a full `SectionCarrier`. */
export function relationGraphOfCells(cells) {
    if (cells.length === 0)
        throw new TypeError("an empty section presents no relation graph");
    const terms = [];
    const indexOf = (term) => {
        const found = terms.findIndex((candidate) => sameTerm(candidate, term));
        if (found !== -1)
            return found;
        terms.push(term);
        return terms.length - 1;
    };
    const pairs = [];
    for (const cell of cells) {
        const subject = indexOf(cell.subject);
        const object = indexOf(cell.object);
        if (subject !== object)
            pairs.push([subject, object]);
    }
    const weights = terms.map((_term, row) => terms.map((__term, column) => fromNatural(count(pairs.filter(([a, b]) => (a === row && b === column) || (a === column && b === row))))));
    return Object.freeze({
        kind: "meme-analysis.laplacian.graph",
        terms: Object.freeze(terms),
        weights: Object.freeze(weights.map((row) => Object.freeze(row))),
    });
}
/** The relation graph of a section (its entries' cells). Delegates to {@link relationGraphOfCells}. */
export function relationGraph(section) {
    return relationGraphOfCells(section.entries.map((entry) => entry.cell));
}
/** The combinatorial Laplacian L = D − W of a symmetric weighted adjacency matrix, exact integer
 *  entries. The bare-matrix core the graph readings delegate to. */
export function laplacianOfWeights(weights) {
    return Object.freeze(weights.map((row, index) => Object.freeze(row.map((weight, column) => column === index ? row.reduce((sum, value) => intAdd(sum, value), intZero) : intNegate(weight)))));
}
/** The combinatorial Laplacian L = D − W of a relation graph, exact integer entries. */
export function laplacianOf(graph) {
    return laplacianOfWeights(graph.weights);
}
const requireObservable = (graph, values) => {
    if (values.length !== graph.terms.length)
        throw new TypeError("an observable assigns a value to every term of the graph");
};
/** The deviation operator on a rational observable (exact, carrier-valued). */
export function deviationOf(graph, values) {
    requireObservable(graph, values);
    const laplacian = laplacianOf(graph);
    return Object.freeze(laplacian.map((row) => row.reduce((sum, entry, column) => ratAdd(sum, ratMultiply(fromInteger(entry), values[column])), ratZero)));
}
/** Whether an observable is a harmonic mode. */
export function harmonic(graph, values) {
    const deviations = deviationOf(graph, values);
    const failing = deviations.findIndex((value) => !ratIsZero(value));
    if (failing !== -1) {
        return Object.freeze({
            kind: "meme-analysis.laplacian.harmonic-obstruction",
            graph,
            values: Object.freeze([...values]),
            atTerm: graph.terms[failing],
            deviation: deviations[failing],
        });
    }
    return Object.freeze({ kind: "meme-analysis.laplacian.harmonic:witness", graph, values: Object.freeze([...values]) });
}
/** The connected-component count of a bare weighted graph (zero-eigenvalue multiplicity = rank
 *  deficiency; n − rank(L), so isolated vertices are counted). */
export function componentCountOfWeights(weights) {
    return monus(count(weights), rank(laplacianOfWeights(weights)));
}
/** The connected-component count (zero-eigenvalue multiplicity = rank deficiency). */
export function componentCount(graph) {
    return componentCountOfWeights(graph.weights);
}
/** The characteristic polynomial of L (the exact spectrum). */
export function spectrumPolynomial(graph) {
    return charPoly(laplacianOf(graph));
}
/** The weighted spanning-tree count of a bare weighted graph (a reduced-Laplacian determinant;
 *  Matrix-Tree). `0` when the graph is disconnected. */
export function treeCountOfWeights(weights) {
    if (weights.length <= 1)
        return intOne;
    const laplacian = laplacianOfWeights(weights);
    const reduced = laplacian.slice(1).map((row) => row.slice(1));
    return determinant(reduced);
}
/** The weighted spanning-tree count (a reduced-Laplacian determinant; Matrix-Tree). */
export function treeCount(graph) {
    return treeCountOfWeights(graph.weights);
}
/** Whether an integer observable is HARMONIC on a bare weighted graph: `(L·v)(x) = 0` at every
 *  vertex — i.e. `v` lies in `ker L`. Equivalently, `v` is constant on every connected component:
 *  a consensus / equilibrium mode where no value flows along any edge. The exact-ℤ analogue of the
 *  `harmonic` judgment for graphs whose vertices are not predication cells. */
export function isHarmonicOfWeights(weights, values) {
    const laplacian = laplacianOfWeights(weights);
    return laplacian.every((row) => intIsZero(row.reduce((sum, entry, column) => intAdd(sum, intMultiply(entry, values[column])), intZero)));
}
/** The Hodge decomposition of a bare weighted graph (vertices = `weights.length`, edge multiplicity =
 *  the symmetric weights), exact over ℤ. */
export function hodgeDecompositionOfWeights(weights) {
    const exact = monus(count(weights), componentCountOfWeights(weights)); // rank(L) = V − C
    let edgeSum = intZero;
    for (let row = 0; row < weights.length; row += 1) {
        for (let column = row + 1; column < weights.length; column += 1)
            edgeSum = intAdd(edgeSum, weights[row][column]);
    }
    const edges = magnitude(edgeSum);
    return Object.freeze({ kind: "meme-analysis.laplacian.hodge", edges, exact, harmonic: monus(edges, exact) });
}
/** The Hodge decomposition of a relation graph's edge-flow space. */
export function hodgeDecomposition(graph) {
    return hodgeDecompositionOfWeights(graph.weights);
}
/** The structural balance of a signed graph, by union-find with parity: a `+` edge forces equal camp
 *  parity, a `−` edge forces opposite parity; an edge whose endpoints are already in one component
 *  with the wrong relative parity is a frustration. Exact and total. */
export function signedBalance(vertexCount, edges) {
    const parent = Array.from({ length: vertexCount }, (_value, index) => index);
    const parity = new Array(vertexCount).fill(0); // parity from a node to its parent
    const find = (x) => {
        if (parent[x] === x)
            return [x, 0];
        const [root, parentParity] = find(parent[x]);
        parent[x] = root;
        parity[x] = (parity[x] + parentParity) & 1;
        return [root, parity[x]];
    };
    let frustration = 0;
    for (const [left, right, positive] of edges) {
        const want = positive ? 0 : 1; // `+` ⇒ same parity (diff 0); `−` ⇒ opposite (diff 1)
        const [rootLeft, parityLeft] = find(left);
        const [rootRight, parityRight] = find(right);
        if (rootLeft === rootRight) {
            if (((parityLeft ^ parityRight) & 1) !== want)
                frustration += 1;
        }
        else {
            parent[rootLeft] = rootRight;
            parity[rootLeft] = (parityLeft ^ parityRight ^ want) & 1;
        }
    }
    return Object.freeze({ kind: "meme-analysis.laplacian.signed-balance", balanced: frustration === 0, frustration });
}
/** The connected-component label of every vertex of a bare weighted graph (union-find over the
 *  positive-weight edges; labels are `0 … C−1` by first appearance). */
function componentLabels(weights) {
    const n = weights.length;
    const parent = Array.from({ length: n }, (_value, index) => index);
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (let row = 0; row < n; row += 1) {
        for (let column = row + 1; column < n; column += 1)
            if (!intIsZero(weights[row][column]))
                parent[find(row)] = find(column);
    }
    const label = new Map();
    return Array.from({ length: n }, (_value, index) => {
        const root = find(index);
        if (!label.has(root))
            label.set(root, label.size);
        return label.get(root);
    });
}
/** The DIFFUSION ENDPOINT of an integer observable `v` on a bare weighted graph: each vertex relaxes
 *  to the net consensus DIRECTION of its connected component — `sign(Σ_{component} v) ∈ {−1, 0, +1}`.
 *  This is the exact integer shadow of the harmonic projection `lim_{t→∞} e^{−tL} v` (the projection
 *  onto `ker L`, equal per-component to the value MEAN); its sign is the direction the component
 *  settles toward under diffusion. Returns one `{−1,0,+1}` integer per vertex, in vertex order. */
export function diffusionDirections(weights, values) {
    const labels = componentLabels(weights);
    const componentCount = labels.reduce((max, label) => Math.max(max, label + 1), 0);
    const sums = Array.from({ length: componentCount }, () => intZero);
    labels.forEach((label, index) => { sums[label] = intAdd(sums[label], values[index]); });
    const signs = sums.map((sum) => (intIsZero(sum) ? intZero : isNegative(sum) ? intNegate(intOne) : intOne));
    return Object.freeze(labels.map((label) => signs[label]));
}
/** The exact symmetric integer adjacency matrix of a bare undirected multigraph on `vertexCount`
 *  vertices (`0 … vertexCount−1`), weighted by edge multiplicity; self-loops are ignored. Unlike
 *  {@link relationGraphOfCells}, the vertex set is FIXED, so isolated vertices are represented. */
export function weightsOfEdges(vertexCount, edges) {
    const pairs = edges.filter(([left, right]) => left !== right);
    return Object.freeze(Array.from({ length: vertexCount }, (_row, row) => Object.freeze(Array.from({ length: vertexCount }, (_column, column) => fromNatural(count(pairs.filter(([left, right]) => (left === row && right === column) || (left === column && right === row))))))));
}
/** Read a bare undirected graph's spectral invariants (component count H⁰ + Matrix-Tree spanning-tree
 *  count) directly from a fixed vertex set and an edge list — for graphs whose vertices are NOT
 *  predication cells (observer graphs, agent graphs), where isolated vertices must be counted. */
export function graphSpectrum(vertexCount, edges) {
    const weights = weightsOfEdges(vertexCount, edges);
    return Object.freeze({
        kind: "meme-analysis.laplacian.spectrum",
        components: componentCountOfWeights(weights),
        spanningTrees: treeCountOfWeights(weights),
    });
}
//# sourceMappingURL=laplacian.mjs.map