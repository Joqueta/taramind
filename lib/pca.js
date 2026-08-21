/**
 * Projette des vecteurs de grande dimension en 2D via PCA
 * (technique de la matrice de Gram, efficace quand n_points << n_dimensions).
 * @param {number[][]} vectors - tableau de vecteurs (ex: embeddings 768D)
 * @returns {Array<{x: number, y: number}>} coordonnées 2D, une par vecteur
 */
export function pca2D(vectors) {
    const n = vectors.length;
    if (n === 0) return [];
    if (n === 1) return [{ x: 0, y: 0 }];

    const dim = vectors[0].length;

    // Centrer les vecteurs (moyenne = 0)
    const mean = new Array(dim).fill(0);
    for (const v of vectors) {
        for (let i = 0; i < dim; i++) mean[i] += v[i] / n;
    }
    const centered = vectors.map((v) => v.map((val, i) => val - mean[i]));

    // Matrice de Gram (n x n) : produits scalaires entre chaque paire de points
    const gram = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) {
            let dot = 0;
            for (let k = 0; k < dim; k++) dot += centered[i][k] * centered[j][k];
            gram[i][j] = dot;
            gram[j][i] = dot;
        }
    }

    const { vector: u1, eigenvalue: l1 } = topEigenvector(gram, n);
    const deflated = deflate(gram, u1, l1, n);
    const { vector: u2, eigenvalue: l2 } = topEigenvector(deflated, n);

    const s1 = Math.sqrt(Math.max(l1, 0));
    const s2 = Math.sqrt(Math.max(l2, 0));

    return u1.map((_, i) => ({ x: u1[i] * s1, y: u2[i] * s2 }));
}

function topEigenvector(matrix, n, iterations = 150) {
    let v = new Array(n).fill(0).map(() => Math.random() - 0.5);
    v = normalize(v);

    for (let iter = 0; iter < iterations; iter++) {
        v = matVecMul(matrix, v, n);
        v = normalize(v);
    }

    const mv = matVecMul(matrix, v, n);
    const eigenvalue = dot(v, mv, n);
    return { vector: v, eigenvalue };
}

function deflate(matrix, u, lambda, n) {
    const result = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            result[i][j] = matrix[i][j] - lambda * u[i] * u[j];
        }
    }
    return result;
}

function matVecMul(matrix, v, n) {
    const result = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < n; j++) sum += matrix[i][j] * v[j];
        result[i] = sum;
    }
    return result;
}

function normalize(v) {
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
}

function dot(a, b, n) {
    let s = 0;
    for (let i = 0; i < n; i++) s += a[i] * b[i];
    return s;
}