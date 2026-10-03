import crypto from 'node:crypto';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const SERPAPI_ENDPOINT = 'https://serpapi.com/search.json';
const CLOUDINARY_API_ENDPOINT = 'https://api.cloudinary.com/v1_1';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeTitle = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const slugify = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 90);

const hash8 = (value = '') =>
  crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 8).toUpperCase();

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const median = (values = []) => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const calculateSellingPrice = (referencePrice, markupPercent, roundTo) => {
  if (!Number.isFinite(referencePrice) || referencePrice <= 0) return null;
  const multiplier = 1 + (clamp(Number(markupPercent) || 0, 0, 500) / 100);
  let price = referencePrice * multiplier;
  const step = Math.max(0, Number(roundTo) || 0);
  if (step > 0) price = Math.round(price / step) * step;
  return Math.max(1, Math.round(price * 100) / 100);
};

const jsonFetch = async (url, options = {}, label = 'External API') => {
  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs || 30000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || `${label} returned invalid JSON.` };
    }

    if (!response.ok) {
      const error = new Error(
        data?.error?.message ||
          data?.error ||
          `${label} failed (${response.status}).`
      );
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`${label} timed out after ${timeoutMs}ms.`);
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const serpApiSearch = async (config, params) => {
  if (!config.serpApiKey) {
    const error = new Error('SERPAPI_KEY is not configured.');
    error.status = 503;
    throw error;
  }
  const query = new URLSearchParams({
    ...params,
    api_key: config.serpApiKey,
  });
  return jsonFetch(`${SERPAPI_ENDPOINT}?${query.toString()}`, {}, 'SerpApi');
};

const isRetryableAiError = (error) => {
  const status = Number(error?.status);
  return (
    !Number.isFinite(status) ||
    [408, 409, 425, 429, 500, 502, 503, 504].includes(status)
  );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildAiResponseFormat = (responseSchema) => ({
  type: 'json_schema',
  json_schema: {
    name: 'catalog_products',
    strict: true,
    schema: responseSchema,
  },
});

const getAiMessages = (prompt) => [
  {
    role: 'system',
    content:
      'You are a careful ecommerce catalog assistant. Never invent technical specifications, compatibility, warranty details, measurements, or included items. Use only facts present in the supplied evidence. When evidence is insufficient, return an empty value and a warning. Produce concise, store-ready copy.',
  },
  { role: 'user', content: prompt },
];

const parseStructuredAiResponse = (data, providerName) => {
  const text = data?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    const error = new Error(`${providerName} returned an empty response.`);
    error.status = 502;
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch {
    const error = new Error(`${providerName} returned invalid structured JSON.`);
    error.status = 502;
    throw error;
  }
};

const callGroq = async (config, prompt, responseSchema) => {
  if (!config.groqApiKey) {
    const error = new Error('GROQ_API_KEY is not configured.');
    error.status = 503;
    throw error;
  }

  const data = await jsonFetch(
    GROQ_ENDPOINT,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.groqApiKey}`,
      },
      body: JSON.stringify({
        model: config.groqModel || 'openai/gpt-oss-120b',
        messages: getAiMessages(prompt),
        reasoning_effort: 'low',
        temperature: 0.2,
        max_completion_tokens: 6000,
        response_format: buildAiResponseFormat(responseSchema),
      }),
      timeoutMs: config.aiRequestTimeoutMs || 30000,
    },
    'Groq'
  );

  return parseStructuredAiResponse(data, 'Groq');
};

const runGroq = async (config, prompt, responseSchema) => {
  const retryCount = Math.max(
    0,
    Math.min(2, Number(config.aiProviderRetries ?? 1))
  );
  const errors = [];

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const result = await callGroq(config, prompt, responseSchema);
      return {
        result,
        provider: 'Groq',
        model: config.groqModel || 'openai/gpt-oss-120b',
      };
    } catch (error) {
      errors.push(error.message);

      if (!isRetryableAiError(error) || attempt >= retryCount) break;
      await sleep(750 * (attempt + 1));
    }
  }

  const error = new Error(
    errors.length
      ? `Groq AI request failed after ${errors.length} attempt(s). ${errors.join(' | ')}`
      : 'Groq AI request failed.'
  );
  error.status = 503;
  throw error;
};

const productSchema = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          name: { type: 'string' },
          category: { type: 'string' },
          description: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'index',
          'name',
          'category',
          'description',
          'features',
          'warnings',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['products'],
  additionalProperties: false,
};

const BLOCKED_IMAGE_HOSTS = [
  'lookaside.instagram.com',
  'instagram.com',
  'www.instagram.com',
  'facebook.com',
  'www.facebook.com',
  'fbcdn.net',
  'www.fbcdn.net',
  'tiktok.com',
  'www.tiktok.com',
];

const normalizeHttpUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
};

const isUsableImageCandidate = (value, source = '') => {
  const url = normalizeHttpUrl(value);
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    const sourceName = String(source || '').toLowerCase();

    if (BLOCKED_IMAGE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
      return false;
    }

    if (
      hostname === 'lookaside.instagram.com' ||
      pathname.includes('/seo/google_widget/crawler/') ||
      pathname.endsWith('.html') ||
      pathname.endsWith('.htm') ||
      sourceName.includes('instagram') ||
      sourceName.includes('facebook')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

const pickCandidateImages = (images = []) => {
  const seen = new Set();

  const ranked = images
    .flatMap((item) => {
      const source = item?.source || '';
      const candidates = [
        {
          url: item?.original,
          width: toFiniteNumber(item?.original_width) || 0,
          height: toFiniteNumber(item?.original_height) || 0,
          source,
          kind: 'original',
        },
        {
          url: item?.thumbnail,
          width: toFiniteNumber(item?.thumbnail_width) || 0,
          height: toFiniteNumber(item?.thumbnail_height) || 0,
          source,
          kind: 'thumbnail',
        },
      ];

      return candidates
        .map((candidate) => ({ ...candidate, url: normalizeHttpUrl(candidate.url) }))
        .filter((candidate) => candidate.url && isUsableImageCandidate(candidate.url, candidate.source));
    })
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .sort((a, b) => {
      const score = (item) => {
        const area = item.width * item.height;
        const originalBonus = item.kind === 'original' ? 100000000 : 0;
        return area + originalBonus;
      };
      return score(b) - score(a);
    });

  return ranked.slice(0, 6);
};

const searchImagesForProduct = async (config, name) => {
  const data = await serpApiSearch(config, {
    engine: 'google_images',
    q: `${name} official product image -instagram -facebook -tiktok`,
    gl: config.researchCountry || 'IN',
    hl: 'en',
    num: '12',
  });
  return pickCandidateImages(data?.images_results || []);
};

const cloudinarySignature = (params, apiSecret) => {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return crypto.createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex');
};

const uploadRemoteImageToCloudinary = async (config, remoteUrl, publicId) => {
  if (!config.cloudinaryCloudName || !config.cloudinaryApiKey || !config.cloudinaryApiSecret) {
    const error = new Error('Cloudinary credentials are not configured.');
    error.status = 503;
    throw error;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = config.cloudinaryFolder || 'creators-desk/catalog';
  const signatureParams = { folder, public_id: publicId, timestamp };
  const signature = cloudinarySignature(signatureParams, config.cloudinaryApiSecret);

  const body = new URLSearchParams({
    file: remoteUrl,
    api_key: config.cloudinaryApiKey,
    timestamp: String(timestamp),
    folder,
    public_id: publicId,
    signature,
  });

  const data = await jsonFetch(
    `${CLOUDINARY_API_ENDPOINT}/${encodeURIComponent(config.cloudinaryCloudName)}/image/upload`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      timeoutMs: 45000,
    },
    'Cloudinary'
  );

  if (!data?.secure_url) {
    const error = new Error('Cloudinary did not return a secure image URL.');
    error.status = 502;
    throw error;
  }

  return data.secure_url;
};

const buildQueries = (brief, category) => {
  const cleanBrief = String(brief || '').trim();
  const cleanCategory = String(category || '').trim();
  const combined = cleanCategory ? `${cleanBrief} ${cleanCategory}` : cleanBrief;
  return [...new Set([
    combined,
    `${combined} India`,
    `${combined} latest models`,
  ].map((value) => value.trim()).filter(Boolean))].slice(0, 3);
};

const collectShoppingCandidates = async (config, { brief, category, count }) => {
  const queries = buildQueries(brief, category);
  const candidates = new Map();

  for (const query of queries) {
    const data = await serpApiSearch(config, {
      engine: 'google_shopping',
      q: query,
      gl: config.researchCountry || 'IN',
      hl: 'en',
      location: 'India',
      num: String(Math.min(40, Math.max(12, count * 2))),
    });

    for (const item of data?.shopping_results || []) {
      const title = String(item.title || '').trim();
      if (!title) continue;

      const key = normalizeTitle(title);
      const existing = candidates.get(key);
      const price = toFiniteNumber(item.extracted_price);
      const evidence = {
        title,
        source: item.source || '',
        price: Number.isFinite(price) ? price : null,
        priceText: item.price || '',
        link: item.link || item.product_link || '',
        snippet: item.snippet || item.tagline || '',
        rating: toFiniteNumber(item.rating),
        reviews: toFiniteNumber(item.reviews),
        thumbnail: item.thumbnail || '',
      };

      if (!existing) {
        candidates.set(key, {
          title,
          evidence: [evidence],
          imageUrl: item.thumbnail || '',
        });
      } else {
        existing.evidence.push(evidence);
        if (!existing.imageUrl && item.thumbnail) existing.imageUrl = item.thumbnail;
      }
    }
  }

  return [...candidates.values()]
    .map((candidate) => {
      const prices = candidate.evidence.map((item) => item.price).filter((value) => Number.isFinite(value));
      const referencePrice = median(prices);
      const primary = candidate.evidence[0] || {};
      return {
        ...candidate,
        referencePrice,
        sourceUrl: primary.link || '',
        sourceName: primary.source || '',
      };
    })
    .filter((candidate) => candidate.referencePrice === null || candidate.referencePrice > 0)
    .slice(0, Math.max(count * 2, count));
};

export async function researchCatalogProducts(config, options = {}) {
  const brief = String(options.brief || '').trim();
  if (!brief) {
    const error = new Error('Tell us what kind of products you want to research.');
    error.status = 400;
    throw error;
  }

  const count = clamp(Math.trunc(Number(options.count) || 10), 1, config.catalogResearchMaxProducts || 30);
  const categoryHint = String(options.category || '').trim();
  const markupPercent = clamp(Number(options.markupPercent) || 0, 0, 500);
  const roundTo = Math.max(0, Number(options.roundTo) || 0);
  const quantity = Math.max(0, Math.trunc(Number(options.quantity) || 0));
  const minSellingPrice = Number.isFinite(Number(options.minSellingPrice)) ? Number(options.minSellingPrice) : null;
  const maxSellingPrice = Number.isFinite(Number(options.maxSellingPrice)) ? Number(options.maxSellingPrice) : null;

  const rawCandidates = await collectShoppingCandidates(config, {
    brief,
    category: categoryHint,
    count,
  });

  if (!rawCandidates.length) {
    const error = new Error('No product candidates were found. Try a more specific product/category phrase.');
    error.status = 404;
    throw error;
  }

  const evidenceForGroq = rawCandidates.map((candidate, index) => ({
    index,
    shoppingTitle: candidate.title,
    source: candidate.sourceName,
    referencePriceInr: candidate.referencePrice,
    sources: candidate.evidence.slice(0, 3).map((item) => ({
      title: item.title,
      source: item.source,
      price: item.priceText || item.price,
      link: item.link,
      snippet: item.snippet,
    })),
  }));

  const ai = await runGroq(
    config,
    JSON.stringify({
      task: 'Normalize product candidates for a computer, accessories, and technology ecommerce catalog.',
      instructions: [
        'Keep the actual product/model identity from the shopping evidence.',
        'Do not add technical specifications unless the evidence contains them.',
        'Write a concise customer-facing description of 1–2 sentences.',
        'Return 3–7 short features only when supported by evidence; otherwise return fewer.',
        categoryHint ? `Prefer the supplied category when appropriate: ${categoryHint}` : 'Choose a sensible catalog category such as Laptops, Keyboards, Mice, Networking, Storage, Components, Monitors, Accessories, Audio, or Cables.',
      ],
      candidates: evidenceForGroq,
    }),
    productSchema
  );

  const normalized = ai.result?.products || [];
  const normalizedMap = new Map((Array.isArray(normalized) ? normalized : []).map((item) => [Number(item.index), item]));

  const products = rawCandidates
    .map((candidate, index) => {
      const ai = normalizedMap.get(index) || {};
      const name = String(ai.name || candidate.title).trim();
      const category = String(ai.category || categoryHint || 'Accessories').trim();
      const sellingPrice = calculateSellingPrice(candidate.referencePrice, markupPercent, roundTo);
      const priceInRange = (
        sellingPrice === null ||
        ((minSellingPrice === null || sellingPrice >= minSellingPrice) &&
          (maxSellingPrice === null || sellingPrice <= maxSellingPrice))
      );
      const slug = slugify(name) || `product-${hash8(candidate.title).toLowerCase()}`;
      const sku = `CD-RES-${hash8(`${name}|${candidate.sourceUrl}`)}`;
      const warnings = [
        ...(Array.isArray(ai.warnings) ? ai.warnings.filter(Boolean) : []),
        ...(candidate.referencePrice === null ? ['No INR reference price was found in the shopping results.'] : []),
        ...(!candidate.sourceUrl ? ['No source product page URL was returned.'] : []),
      ];

      return {
        id: `${sku}-${index}`,
        sku,
        name,
        slug,
        category,
        price: sellingPrice,
        referencePriceInr: candidate.referencePrice,
        quantity,
        imageUrl: candidate.imageUrl || '',
        description: String(ai.description || '').trim(),
        features: Array.isArray(ai.features) ? ai.features.filter(Boolean).slice(0, 8) : [],
        sourceUrl: candidate.sourceUrl,
        sourceName: candidate.sourceName,
        warnings,
        selected: priceInRange,
      };
    })
    .filter((product) => product.selected)
    .slice(0, count);

  if (!products.length) {
    const error = new Error('Products were found, but none matched the target selling-price range.');
    error.status = 404;
    throw error;
  }

  return {
    aiProvider: ai.provider,
    model: ai.model,
    searchProvider: 'SerpApi Google Shopping + Google Images',
    products,
    pricing: {
      markupPercent,
      roundTo,
      quantity,
      minSellingPrice,
      maxSellingPrice,
    },
  };
}

export async function prepareCatalogResearchProducts(config, rows = []) {
  if (!Array.isArray(rows) || !rows.length) {
    const error = new Error('No approved research products were supplied.');
    error.status = 400;
    throw error;
  }

  if (rows.length > (config.catalogResearchMaxProducts || 30)) {
    const error = new Error(`Research preparation is limited to ${config.catalogResearchMaxProducts || 30} products at a time.`);
    error.status = 400;
    throw error;
  }

  const prepared = [];

  for (const [index, raw] of rows.entries()) {
    const name = String(raw?.name || '').trim();
    const category = String(raw?.category || '').trim();
    const description = String(raw?.description || '').trim();
    const price = Number(raw?.price);
    const quantity = Math.max(0, Math.trunc(Number(raw?.quantity) || 0));
    const features = Array.isArray(raw?.features)
      ? raw.features.map((value) => String(value).trim()).filter(Boolean)
      : [];

    if (!name || !category || !description || !Number.isFinite(price) || price <= 0) {
      const error = new Error(`Research row ${index + 1} is missing a valid name, category, price, or description.`);
      error.status = 400;
      throw error;
    }

    const searchedImages = await searchImagesForProduct(config, name);
    const fallbackImage = String(raw?.imageUrl || '').trim();
    const imageCandidates = [
      ...searchedImages,
      ...(isUsableImageCandidate(fallbackImage) ? [{ url: normalizeHttpUrl(fallbackImage), source: 'research result' }] : []),
    ];

    if (!imageCandidates.length) {
      prepared.push({
        sku: String(raw?.sku || `CD-RES-${hash8(`${name}|${raw?.sourceUrl || ''}`)}`).trim(),
        name,
        slug: slugify(raw?.slug || name) || `product-${hash8(name).toLowerCase()}`,
        category,
        price: Math.round(price * 100) / 100,
        quantity,
        image: '',
        description,
        features,
        sourceUrl: String(raw?.sourceUrl || '').trim(),
        sourceName: String(raw?.sourceName || '').trim(),
        imageError: 'No usable product image candidates were found.',
      });
      continue;
    }

    const slug = slugify(raw?.slug || name) || `product-${hash8(name).toLowerCase()}`;
    const sku = String(raw?.sku || `CD-RES-${hash8(`${name}|${raw?.sourceUrl || ''}`)}`).trim();
    const publicId = `${slug}-${hash8(sku)}`.toLowerCase();

    let image = '';
    let lastImageError = '';

    for (const candidate of imageCandidates.slice(0, 6)) {
      try {
        image = await uploadRemoteImageToCloudinary(config, candidate.url, publicId);
        break;
      } catch (error) {
        lastImageError = error.message || 'Cloudinary could not load the image.';
        console.warn(
          `[CD_ADMIN] Image candidate failed for "${name}" from ${candidate.source || 'unknown source'}: ${lastImageError}`
        );
      }
    }

    prepared.push({
      sku,
      name,
      slug,
      category,
      price: Math.round(price * 100) / 100,
      quantity,
      image,
      description,
      features,
      sourceUrl: String(raw?.sourceUrl || '').trim(),
      sourceName: String(raw?.sourceName || '').trim(),
      ...(image ? {} : { imageError: lastImageError || 'Cloudinary could not load any of the image candidates.' }),
    });
  }

  return {
    rows: prepared.filter((row) => row.image),
    failed: prepared
      .filter((row) => !row.image)
      .map((row) => ({
        sku: row.sku,
        name: row.name,
        error: row.imageError || 'No usable Cloudinary image was found.',
      })),
  };
}

