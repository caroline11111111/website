import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  brand_id: string | null;
  category_id: string | null;
  description: string | null;
  price_myr: number;
  condition: string | null;
  color: string | null;
  specifications: Record<string, unknown> | null;
  inventory_mode: 'single_item' | 'multiple';
  stock_quantity: number;
  reserved_quantity: number;
  weight_grams: number;
  is_published: boolean;
  sold_out_display: 'show' | 'hide';
  is_archived: boolean;
  created_at: string;
};

type Lookup = { id: string; name: string };
type ProductImage = {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
  signedUrl?: string;
};

type Draft = {
  name: string;
  sku: string;
  brand_id: string;
  category_id: string;
  price_myr: string;
  condition: string;
  color: string;
  description: string;
  stock_quantity: string;
  weight_grams: string;
  inventory_mode: 'single_item' | 'multiple';
  sold_out_display: 'show' | 'hide';
  specifications: string;
};

const emptyDraft = (): Draft => ({
  name: '', sku: '', brand_id: '', category_id: '', price_myr: '',
  condition: '', color: '', description: '', stock_quantity: '1',
  weight_grams: '0', inventory_mode: 'single_item', sold_out_display: 'show',
  specifications: '{}',
});

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-100';
const labelClass = 'block space-y-1 text-sm font-medium text-slate-700';

export function ProductsManagement({ can }: { can: (permission: string) => boolean }) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [brands, setBrands] = useState<Lookup[]>([]);
  const [categories, setCategories] = useState<Lookup[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageProductId, setImageProductId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const [productResult, brandResult, categoryResult] = await Promise.all([
      supabase.from('products')
        .select('id,name,sku,brand_id,category_id,description,price_myr,condition,color,specifications,inventory_mode,stock_quantity,reserved_quantity,weight_grams,is_published,sold_out_display,is_archived,created_at')
        .order('created_at', { ascending: false }),
      supabase.from('brands').select('id,name').eq('is_active', true).order('display_order'),
      supabase.from('categories').select('id,name').eq('is_active', true).order('display_order'),
    ]);
    if (productResult.error) setError(productResult.error.message);
    else setProducts((productResult.data || []) as ProductRow[]);
    if (brandResult.error) setError(brandResult.error.message);
    else setBrands((brandResult.data || []) as Lookup[]);
    if (categoryResult.error) setError(categoryResult.error.message);
    else setCategories((categoryResult.data || []) as Lookup[]);
    setLoading(false);
  }, []);

  const loadImages = useCallback(async (productId: string) => {
    const { data, error: queryError } = await supabase.from('product_images')
      .select('id,product_id,storage_path,alt_text,display_order,is_primary')
      .eq('product_id', productId)
      .order('display_order', { ascending: true });
    if (queryError) {
      setError(queryError.message);
      return;
    }
    const withUrls = await Promise.all((data || []).map(async (image) => {
      const { data: signed, error: signedError } = await supabase.storage
        .from('product-images').createSignedUrl(image.storage_path, 3600);
      return { ...image, signedUrl: signedError ? undefined : signed?.signedUrl } as ProductImage;
    }));
    setImages(withUrls);
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);
  useEffect(() => {
    if (imageProductId) void loadImages(imageProductId);
    else setImages([]);
  }, [imageProductId, loadImages]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (filter === 'published' && (!product.is_published || product.is_archived)) return false;
      if (filter === 'draft' && (product.is_published || product.is_archived)) return false;
      if (filter === 'archived' && !product.is_archived) return false;
      if (!term) return true;
      return [product.name, product.sku].some((value) => value?.toLowerCase().includes(term));
    });
  }, [products, filter, search]);

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const startCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setError('');
    setNotice('');
  };

  const startEdit = (product: ProductRow) => {
    setEditingId(product.id);
    setDraft({
      name: product.name,
      sku: product.sku,
      brand_id: product.brand_id || '',
      category_id: product.category_id || '',
      price_myr: String(product.price_myr),
      condition: product.condition || '',
      color: product.color || '',
      description: product.description || '',
      stock_quantity: String(product.stock_quantity),
      weight_grams: String(product.weight_grams),
      inventory_mode: product.inventory_mode,
      sold_out_display: product.sold_out_display,
      specifications: JSON.stringify(product.specifications || {}, null, 2),
    });
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    setNotice('');
    let specifications: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(draft.specifications || '{}');
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('Specifications must be a JSON object.');
      }
      specifications = parsed as Record<string, unknown>;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid specifications JSON.');
      return;
    }
    const price = Number(draft.price_myr);
    const stock = Number(draft.stock_quantity);
    const weight = Number(draft.weight_grams);
    if (!draft.name.trim() || !draft.sku.trim() || !Number.isFinite(price) || price < 0 ||
        !Number.isInteger(stock) || stock < 0 || !Number.isInteger(weight) || weight < 0) {
      setError('Please check the product name, SKU, price, stock and weight.');
      return;
    }
    if (draft.inventory_mode === 'single_item' && stock > 1) {
      setError('Single-item products can only have an initial stock quantity of 0 or 1. Choose Multiple units for larger stock.');
      return;
    }
    const payload = {
      name: draft.name.trim(),
      sku: draft.sku.trim(),
      brand_id: draft.brand_id || null,
      category_id: draft.category_id || null,
      price_myr: price,
      condition: draft.condition.trim() || null,
      color: draft.color.trim() || null,
      description: draft.description.trim() || null,
      weight_grams: weight,
      inventory_mode: draft.inventory_mode,
      sold_out_display: draft.sold_out_display,
      specifications,
    };
    setSaving(true);
    const result = editingId
      ? await supabase.from('products').update(payload).eq('id', editingId).select('id').single()
      : await supabase.from('products').insert({ ...payload, stock_quantity: stock, is_published: false }).select('id').single();
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setNotice(editingId ? 'Product updated.' : 'Product created as an unpublished draft.');
    setEditingId(null);
    setDraft(emptyDraft());
    await loadProducts();
  };

  const togglePublish = async (product: ProductRow) => {
    setError('');
    const { error: updateError } = await supabase.from('products')
      .update({ is_published: !product.is_published }).eq('id', product.id);
    if (updateError) setError(updateError.message);
    else {
      setNotice(product.is_published ? 'Product unpublished.' : 'Product published.');
      await loadProducts();
    }
  };

  const archiveProduct = async (product: ProductRow) => {
    const reason = window.prompt('Please enter the archive reason:');
    if (!reason?.trim()) return;
    setError('');
    const { error: archiveError } = await supabase.rpc('archive_product', {
      p_product_id: product.id,
      p_reason: reason.trim(),
    });
    if (archiveError) setError(archiveError.message);
    else {
      setNotice('Product archived. Its historical records have been preserved.');
      await loadProducts();
    }
  };

  const uploadImage = async (product: ProductRow, file: File) => {
    setError('');
    setNotice('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a JPG, PNG or WebP image no larger than 5 MB.');
      return;
    }
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
    const path = `${product.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      setError(`Image upload failed: ${uploadError.message}. Confirm that the product-images bucket and its Admin upload policy exist.`);
      return;
    }
    const { error: insertError } = await supabase.from('product_images').insert({
      product_id: product.id,
      storage_path: path,
      alt_text: product.name,
      display_order: images.length,
      is_primary: images.length === 0,
    });
    if (insertError) {
      setError(`Image uploaded but its product record could not be saved: ${insertError.message}. The file may need cleanup by an authorized administrator.`);
      return;
    }
    setNotice('Product image uploaded.');
    await loadImages(product.id);
  };

  const makePrimary = async (image: ProductImage) => {
    const { error: clearError } = await supabase.from('product_images')
      .update({ is_primary: false }).eq('product_id', image.product_id);
    if (clearError) { setError(clearError.message); return; }
    const { error: setErrorResult } = await supabase.from('product_images')
      .update({ is_primary: true }).eq('id', image.id);
    if (setErrorResult) setError(setErrorResult.message);
    else await loadImages(image.product_id);
  };

  const moveImage = async (image: ProductImage, direction: -1 | 1) => {
    const sorted = [...images].sort((a, b) => a.display_order - b.display_order);
    const index = sorted.findIndex((item) => item.id === image.id);
    const other = sorted[index + direction];
    if (!other) return;
    const { error: firstError } = await supabase.from('product_images')
      .update({ display_order: other.display_order }).eq('id', image.id);
    if (firstError) { setError(firstError.message); return; }
    const { error: secondError } = await supabase.from('product_images')
      .update({ display_order: image.display_order }).eq('id', other.id);
    if (secondError) setError(secondError.message);
    else await loadImages(image.product_id);
  };

  const deleteImage = async (image: ProductImage) => {
    if (!window.confirm('Delete this product image? This cannot be undone.')) return;
    setError('');
    const { error: rowError } = await supabase.from('product_images').delete().eq('id', image.id);
    if (rowError) { setError(rowError.message); return; }
    const { error: fileError } = await supabase.storage.from('product-images').remove([image.storage_path]);
    if (fileError) setError(`Image record removed, but the storage file could not be removed: ${fileError.message}`);
    else setNotice('Product image deleted.');
    await loadImages(image.product_id);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Product Management</h2>
          <p className="mt-1 text-sm text-slate-500">Manage catalogue details, inventory display and product photography.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void loadProducts()} className="rounded-lg border bg-white px-3 py-2 text-sm">Refresh</button>
          {can('products.create') && <button onClick={startCreate} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Add product</button>}
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

      {(can('products.create') || (editingId && can('products.edit'))) && (
        <form onSubmit={saveProduct} className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{editingId ? 'Edit product' : 'New product'}</h3>
            <button type="button" onClick={startCreate} className="text-sm text-slate-500 underline">Clear form</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className={labelClass}>Product name<input className={inputClass} required value={draft.name} onChange={(e) => setField('name', e.target.value)} /></label>
            <label className={labelClass}>SKU<input className={inputClass} required value={draft.sku} onChange={(e) => setField('sku', e.target.value)} /></label>
            <label className={labelClass}>Price (MYR)<input className={inputClass} required type="number" min="0" step="0.01" value={draft.price_myr} onChange={(e) => setField('price_myr', e.target.value)} /></label>
            <label className={labelClass}>Brand<select className={inputClass} value={draft.brand_id} onChange={(e) => setField('brand_id', e.target.value)}><option value="">Select brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
            <label className={labelClass}>Category<select className={inputClass} value={draft.category_id} onChange={(e) => setField('category_id', e.target.value)}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className={labelClass}>Condition<input className={inputClass} value={draft.condition} onChange={(e) => setField('condition', e.target.value)} placeholder="e.g. Excellent" /></label>
            <label className={labelClass}>Color<input className={inputClass} value={draft.color} onChange={(e) => setField('color', e.target.value)} /></label>
            <label className={labelClass}>Stock quantity<input className={inputClass} required type="number" min="0" step="1" value={draft.stock_quantity} onChange={(e) => setField('stock_quantity', e.target.value)} readOnly={!!editingId} />{editingId && <span className="text-xs font-normal text-slate-500">Use Inventory to adjust existing stock so every change is recorded.</span>}</label>
            <label className={labelClass}>Weight (grams)<input className={inputClass} required type="number" min="0" step="1" value={draft.weight_grams} onChange={(e) => setField('weight_grams', e.target.value)} /></label>
            <label className={labelClass}>Inventory mode<select className={inputClass} value={draft.inventory_mode} onChange={(e) => setField('inventory_mode', e.target.value as Draft['inventory_mode'])}><option value="single_item">Single item</option><option value="multiple">Multiple units</option></select></label>
            <label className={labelClass}>Sold-out display<select className={inputClass} value={draft.sold_out_display} onChange={(e) => setField('sold_out_display', e.target.value as Draft['sold_out_display'])}><option value="show">Show sold-out product</option><option value="hide">Hide sold-out product</option></select></label>
            <label className={labelClass + ' md:col-span-2 xl:col-span-3'}>Description<textarea className={inputClass} rows={3} value={draft.description} onChange={(e) => setField('description', e.target.value)} /></label>
            <label className={labelClass + ' md:col-span-2 xl:col-span-3'}>Custom specifications (JSON object)<textarea className={inputClass + ' font-mono'} rows={4} value={draft.specifications} onChange={(e) => setField('specifications', e.target.value)} /><span className="text-xs font-normal text-slate-500">Example: {"{"}"strap": "Leather", "hardware": "Gold"{"}"}</span></label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button disabled={saving} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create draft product'}</button>
            <button type="button" onClick={startCreate} className="rounded-lg border px-5 py-2.5 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-3">
        <input className={inputClass + ' max-w-sm'} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product name or SKU" />
        <select className={inputClass + ' max-w-xs'} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">All products</option><option value="published">Published</option><option value="draft">Draft / unpublished</option><option value="archived">Archived</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        {loading ? <p className="p-6 text-sm text-slate-500">Loading products…</p> : visibleProducts.length === 0 ? <p className="p-6 text-sm text-slate-500">No products found.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="p-3">Product</th><th className="p-3">SKU</th><th className="p-3">Price</th><th className="p-3">Stock / Reserved</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
              <tbody>{visibleProducts.map((product) => (
                <tr key={product.id} className="border-t align-middle">
                  <td className="p-3 font-medium">{product.name}</td>
                  <td className="p-3 text-slate-500">{product.sku}</td>
                  <td className="p-3 tabular-nums">RM {Number(product.price_myr).toFixed(2)}</td>
                  <td className="p-3 tabular-nums">{product.stock_quantity} / {product.reserved_quantity}</td>
                  <td className="p-3"><span className={'rounded-full px-2 py-1 text-xs ' + (product.is_archived ? 'bg-slate-100 text-slate-600' : product.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{product.is_archived ? 'Archived' : product.is_published ? 'Published' : 'Draft'}</span></td>
                  <td className="space-x-3 p-3 whitespace-nowrap">
                    {!product.is_archived && can('products.edit') && <button onClick={() => startEdit(product)} className="text-blue-700 underline">Edit</button>}
                    {!product.is_archived && can('products.edit') && <button onClick={() => void togglePublish(product)} className="underline">{product.is_published ? 'Unpublish' : 'Publish'}</button>}
                    {!product.is_archived && can('products.edit') && <button onClick={() => setImageProductId(imageProductId === product.id ? null : product.id)} className="underline">Images</button>}
                    {!product.is_archived && can('products.archive') && <button onClick={() => void archiveProduct(product)} className="text-red-700 underline">Archive</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {imageProductId && (
        <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="font-semibold">Product images</h3><p className="text-sm text-slate-500">{products.find((item) => item.id === imageProductId)?.name}</p></div>
            <button onClick={() => setImageProductId(null)} className="text-sm underline">Close</button>
          </div>
          {can('products.edit') && <label className="inline-flex cursor-pointer items-center rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">Upload image<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; const product = products.find((item) => item.id === imageProductId); if (file && product) void uploadImage(product, file); e.currentTarget.value = ''; }} /></label>}
          {images.length === 0 ? <p className="text-sm text-slate-500">No images have been added yet.</p> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image, index) => (
                <article key={image.id} className="overflow-hidden rounded-lg border">
                  {image.signedUrl ? <img src={image.signedUrl} alt={image.alt_text || 'Product image'} className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center bg-slate-100 text-xs text-slate-500">Preview unavailable. Check bucket access.</div>}
                  <div className="space-y-2 p-3">
                    <p className="truncate text-xs text-slate-500">{image.storage_path.split('/').pop()}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {image.is_primary && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">Primary</span>}
                      <button disabled={index === 0} onClick={() => void moveImage(image, -1)} className="underline disabled:opacity-30">Move up</button>
                      <button disabled={index === images.length - 1} onClick={() => void moveImage(image, 1)} className="underline disabled:opacity-30">Move down</button>
                      {!image.is_primary && <button onClick={() => void makePrimary(image)} className="underline">Set primary</button>}
                      <button onClick={() => void deleteImage(image)} className="text-red-700 underline">Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
