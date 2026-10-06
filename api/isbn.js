// Book lookup by ISBN (?isbn=) or free text (?q=). Google Books first, Open Library fallback for ISBNs.
export default async function handler(req, res) {
  const { isbn, q } = req.query;
  const key = process.env.GOOGLE_BOOKS_KEY ? `&key=${process.env.GOOGLE_BOOKS_KEY}` : '';
  const clean = String(isbn || '').replace(/[^0-9Xx]/g, '');
  let items = [];
  try {
    const query = clean ? `isbn:${clean}` : encodeURIComponent(String(q || '').slice(0, 120));
    if (clean || q) {
      const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=${clean ? 3 : 6}${key}`);
      if (r.ok) {
        items = ((await r.json()).items || []).map(({ volumeInfo: v = {} }) => ({
          title: v.title || '', author: (v.authors || []).join(', '), language: v.language || '',
          categories: (v.categories || []).join(' / '), description: (v.description || '').slice(0, 600),
          cover: (v.imageLinks?.thumbnail || '').replace('http:', 'https:'),
          isbn: ((v.industryIdentifiers || []).find(i => i.type === 'ISBN_13') || {}).identifier || clean
        }));
      }
    }
    if (!items.length && clean) {
      const r = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${clean}&format=json&jscmd=data`);
      const b = r.ok ? (await r.json())[`ISBN:${clean}`] : null;
      if (b) items = [{ title: b.title || '', author: (b.authors || []).map(a => a.name).join(', '), language: '',
        categories: (b.subjects || []).slice(0, 5).map(s => s.name).join(' / '), description: '', cover: b.cover?.medium || '', isbn: clean }];
    }
  } catch {}
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
  res.status(200).json({ items });
}
