# Migración B2B / IVA por tratamiento (Fase 0.1)

Archivo: `supabase/migrations/20260601120000_treatments_tax_and_client_b2b.sql`

## Qué añade

| Tabla | Columna | Uso |
|-------|---------|-----|
| `treatments` | `tax_rate` (default 21) | IVA % del PVP (21 estético, 0 exento) |
| `clients` | `is_company` | Factura con retención IRPF |
| `clients` | `irpf_withholding_rate` | % retención (NULL → 7 % si empresa) |

## Aplicar en producción

Cuando el proyecto Supabase esté **Active** y `supabase link` funcione:

```bash
cd /ruta/dermo-manager
supabase link --project-ref <TU_PROJECT_REF>
supabase db push
```

Alternativa: copiar el SQL de la migración en **SQL Editor** del dashboard Supabase y ejecutar.

## Comprobar

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'clients' AND column_name IN ('is_company', 'irpf_withholding_rate');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'treatments' AND column_name = 'tax_rate';
```

## También Fase 0 (inventario)

`supabase/migrations/20260602120000_inventory_soft_delete.sql` — columna `inventory.activo`.
