const stopwords = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "into",
  "what",
  "where",
  "how",
  "are",
  "you",
  "your",
  "can",
  "will",
  "file",
  "code",
]);

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-z0-9_./-]+/)
    .filter((token) => token.length > 1 && !stopwords.has(token))
    .slice(0, 2000);
}

export function buildSearchIndex(chunks) {
  const documentFrequency = {};

  for (const chunk of chunks) {
    const seen = new Set(chunk.tokens);
    for (const token of seen) {
      documentFrequency[token] = (documentFrequency[token] || 0) + 1;
    }
  }

  return {
    totalDocuments: chunks.length,
    documentFrequency,
  };
}

export function searchProject(project, query, limit = 6) {
  const queryTokens = tokenize(query);
  const scores = [];

  for (const chunk of project.chunks) {
    let score = 0;
    const tokenCounts = new Map();

    for (const token of chunk.tokens) {
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    }

    for (const token of queryTokens) {
      const tf = tokenCounts.get(token) || 0;
      if (!tf) continue;
      const df = project.searchIndex.documentFrequency[token] || 1;
      const idf = Math.log((project.searchIndex.totalDocuments + 1) / df);
      score += (1 + Math.log(tf)) * idf;
    }

    if (chunk.path.toLowerCase().includes(query.toLowerCase())) {
      score += 3;
    }

    if (score > 0) {
      scores.push({ ...chunk, score });
    }
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, limit);
}
