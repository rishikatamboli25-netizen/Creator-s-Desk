const TOKEN_PREFIX = 'v1$';

function toBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function createRouteToken(payload) {
  const encodedPayload = toBase64(JSON.stringify(payload));
  return `${TOKEN_PREFIX}${encodedPayload}`;
}

function parseRouteToken(token, expectedType) {
  if (!token || !token.startsWith(TOKEN_PREFIX)) {
    return null;
  }

  try {
    const encodedPayload = token.slice(TOKEN_PREFIX.length);
    const payload = JSON.parse(fromBase64(encodedPayload));

    if (payload?.v !== 1 || payload?.type !== expectedType) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function buildProductUrl(productOrSlug) {
  const slug =
    typeof productOrSlug === 'string'
      ? productOrSlug
      : productOrSlug?.slug || productOrSlug?._id || productOrSlug?.id;

  if (!slug) {
    return '/';
  }

  const token = createRouteToken({
    v: 1,
    type: 'product',
    slug: String(slug),
  });

  return `/p?id=${encodeURIComponent(token)}`;
}

export function decodeProductRouteToken(token) {
  const payload = parseRouteToken(token, 'product');
  return payload?.slug || null;
}

export function buildCategoryUrl(categoryOrSlug) {
  const rawCategory =
    typeof categoryOrSlug === 'string'
      ? categoryOrSlug
      : categoryOrSlug?.category || categoryOrSlug?.slug || categoryOrSlug?.name;

  if (!rawCategory) {
    return '/';
  }

  const categorySlug = String(rawCategory)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  const sid = createRouteToken({
    v: 1,
    type: 'category',
    slug: categorySlug,
  });

  const ctx = createRouteToken({
    v: 1,
    type: 'category-context',
    category: categorySlug,
    view: 'grid',
    sort: 'featured',
    locale: 'en-IN',
  });

  return `/c?sid=${encodeURIComponent(sid)}&ctx=${encodeURIComponent(ctx)}`;
}

export function decodeCategoryRouteToken(sid, ctx = null) {
  const payload = parseRouteToken(sid, 'category');

  if (!payload?.slug) {
    return null;
  }

  if (ctx) {
    const context = parseRouteToken(ctx, 'category-context');

    if (!context || context.category !== payload.slug) {
      return null;
    }
  }

  return payload.slug;
}

export function buildCheckoutUrl() {
  const token = createRouteToken({
    v: 1,
    type: 'checkout',
    flow: 'payment',
    locale: 'en-IN',
  });

  return `/checkout?ref=${encodeURIComponent(token)}`;
}

export function isValidCheckoutRef(token) {
  const payload = parseRouteToken(token, 'checkout');
  return payload?.flow === 'payment';
}
