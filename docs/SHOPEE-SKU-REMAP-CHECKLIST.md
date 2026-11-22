# Shopee SKU Remap Checklist

## Status: FINALIZED (2026-11-23)

Public Shopee API returned `model_sku: null` for every variant. The browser session’s Seller Centre login (`hanifahsyf`) is shop `5408672`, **not** Dapur Dekaka (`20069111`), so Seller Centre SKUs could not be pulled automatically.

**Canonical website SKUs are the `DDK-*` codes below.**  
Shopee internal `modelId` crosswalk: [`data/shopee-model-crosswalk.json`](../data/shopee-model-crosswalk.json)  
Identity remap file: [`data/shopee-sku-remap.json`](../data/shopee-sku-remap.json)

### Optional later (if you export SKUs from the real Dapur Dekaka Seller Centre)

1. Open **Shopee Seller Centre (Dapur Dekaka shop)** → Produk → Mass Update / Export.
2. Edit `data/shopee-sku-remap.json` — set each `"shopeeSku"`.
3. Run:

```bash
npm run remap:shopee-skus
```

## Current temp SKUs (active)

| Product | Variant | Temp SKU | Price (IDR) |
|---------|---------|----------|-------------|
| Dimsum Mix (Siomay) | 25 pcs | `DDK-MIX-25` | 78.000 |
| Dimsum Mix (Siomay) | 50 pcs | `DDK-MIX-50` | 143.300 |
| Saos Mentai/Mayo/Tartar | 100 ml Mentai | `DDK-SAOS-MENT-100` | 25.115 |
| Saos Mentai/Mayo/Tartar | 100 ml Tartar | `DDK-SAOS-TART-100` | 25.115 |
| Saos Mentai/Mayo/Tartar | 100 ml Mayo Keju | `DDK-SAOS-KEJU-100` | 25.115 |
| Saos Mentai/Mayo/Tartar | 250 ml Mentai | `DDK-SAOS-MENT-250` | 40.120 |
| Saos Mentai/Mayo/Tartar | 250 ml Tartar | `DDK-SAOS-TART-250` | 40.120 |
| Saos Mentai/Mayo/Tartar | 250 ml Mayo Keju | `DDK-SAOS-KEJU-250` | 40.120 |
| Dimsum Goreng Keju | 3 pcs | `DDK-GORKEJ-3` | 26.795 |
| Dimsum Goreng Keju | 5 pcs | `DDK-GORKEJ-5` | 39.795 |
| Lumpia Kulit Tahu | 25 pcs | `DDK-LUMP-25` | 83.000 |
| Lumpia Kulit Tahu | 50 pcs | `DDK-LUMP-50` | 154.000 |
| Dimsum Adek Mini | 70 pcs | `DDK-ADEX-70` | 150.000 |
| Dimsum Nori | 25 pcs | `DDK-NORI-25` | 80.000 |
| Dimsum Nori | 50 pcs | `DDK-NORI-50` | 151.000 |
| Ayam Katsu Keju | Default | `DDK-KATSU-1` | 40.000 |
| Pangsit Ayam | 25 pcs | `DDK-PANG-25` | 77.000 |
| Pangsit Ayam | 50 pcs | `DDK-PANG-50` | 138.000 |
| Dimsum Campur | Paket Ibu | `DDK-CAMP-IBU` | 75.000 |
| Dimsum Campur | Paket Bapak | `DDK-CAMP-BAPAK` | 75.000 |
| Dimsum Rambutan | 25 pcs | `DDK-RAMB-25` | 78.000 |
| Dimsum Rambutan | 50 pcs | `DDK-RAMB-50` | 143.000 |
| Dimsum Full Wortel | 25 pcs | `DDK-WORT-25` | 75.000 |
| Dimsum Full Wortel | 50 pcs | `DDK-WORT-50` | 138.000 |
| Dimsum Smoked Beef | 25 pcs | `DDK-SMOK-25` | 75.000 |
| Dimsum Smoked Beef | 50 pcs | `DDK-SMOK-50` | 138.000 |
| Dimsum Full Jamur | 25 pcs | `DDK-JAMU-25` | 75.000 |
| Dimsum Full Jamur | 50 pcs | `DDK-JAMU-50` | 138.000 |
| Dimsum Pedas | 25 pcs | `DDK-PEDA-25` | 78.000 |
| Dimsum Pedas | 50 pcs | `DDK-PEDA-50` | 143.000 |
| Dimsum Full Tuna | 25 pcs | `DDK-TUNA-25` | 75.000 |
| Dimsum Full Tuna | 50 pcs | `DDK-TUNA-50` | 138.000 |

## Already done (catalog sync)

- [x] 15 live Shopee products scraped → `data/shopee-catalog.json`
- [x] Listing images uploaded to Cloudinary (`dapurdekaka/products|sauces`)
- [x] Neon products/variants/images upserted; legacy duplicate variants deactivated
- [x] Off-Shopee products deactivated (crabstick, jamur classic, mozarella, golden, tuna classic, ekado, chili-oil, full-crabstick, mix-luar-kota)
- [x] Trust copy updated: website = Shopee normal/base price (not “always below”)

## Re-sync later

```bash
npx tsx --env-file=.env scripts/sync-shopee-catalog.ts
# or reuse uploaded images:
npx tsx --env-file=.env scripts/sync-shopee-catalog.ts --skip-upload
```
