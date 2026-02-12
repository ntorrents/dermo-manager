# Plan Maestro — Refactorización ERP DermoManager

**Rol:** Senior Full-Stack Developer / Arquitecto de Software  
**Objetivo:** Transformar DermoManager en un ERP profesional para clínica dermoestética (nivel Holded/Odoo), manteniendo simplicidad para uso por autónoma.  
**Requisitos críticos:** Legalidad España (IVA 21%, trazabilidad sanitaria, Verifactu), usabilidad "App-like", código modular y escalable.

---

## PASO 0: ANÁLISIS REALIZADO

### Archivos analizados

| Archivo | Estado actual | Gaps detectados |
|--------|----------------|-----------------|
| **SessionModal.jsx** | Receta editable por sesión (activeRecipe), extras, eliminar ítems de receta. Pasa `treatment` con `recipe` filtrada a `onConfirm`. | Falta campo **Notas Internas** (guardar en sesión, no en factura). |
| **useFinance.js** | Fetch de `finance_entries` por `user_id`, orden por `date` desc. Realtime. | No hay lógica de **series de facturación** ni número correlativo inalterable. |
| **invoiceGenerator.js** | Logo, datos emisor (NIF, dirección, etc.), número `F-YYYYMMDD-{id.slice(0,4)}`, cliente (nombre, apellidos, dirección opcional). Tabla una línea; pie "exento IVA". | Sin **desglose IVA** (base/cuota). Sin **NIF cliente** obligatorio. Sin **placeholder QR Verifactu**. Número de factura no es correlativo ni inalterable. |
| **FinanceTab.jsx** | Formulario ingresos/gastos con `tax_rate`, `base_amount`, `tax_amount` (vía `calculateTaxFromTotal` de `format.js`). Guarda en `finance_entries`. | Sesiones creadas desde SessionModal **no** guardan `tax_base`, `tax_rate`, `invoice_number` (solo `amount`, `related_cost`, `client_id`). |
| **format.js** | `calculateTaxFromTotal(totalAmount, taxRate)` ya calcula base + cuota IVA. `IVA_OPTIONS = [0,4,10,21]`. | Se pide además `calculateTaxReverse(total, rate)` en `calculations.js` (reutilizar misma lógica o centralizar). |
| **useSessionMutation.js** | Inserta en `finance_entries`: `date`, `type`, `category`, `description`, `amount`, `related_cost`, `client_id`. Consume stock con receta + extras. | No envía `tax_base`, `tax_rate`, `tax_amount`, `invoice_number`, `internal_notes`. |
| **ClientsTab.jsx** | Modal edición: name, surname, phone, email, notes, has_consent, has_image_rights, drive_url. Vista detalle: historial (sesiones) + fotos. | Sin **pestañas** (Filiación / Médico / Legal / Historial). Falta **NIF**, **origen** (Instagram/Google/Recomendación), **alergias**, **antecedentes**. Campo drive como `drive_folder_url` (nombre alternativo). |
| **useClientHistory.js** | Historial desde `finance_entries` (type=income, client_id). | Ya sirve para pestaña Historial; solo integrar en nueva UI por pestañas. |
| **DashboardTab.jsx** | KPIs: Beneficio neto, Ingresos/Gastos, Próximos eventos. Gráfica diaria, Top Tratamientos (lista), alertas stock bajo. | Falta **KPI Facturación mes** (grande) vs anterior (%). Falta **"Hucha de Impuestos"** (IVA a pagar). Top Tratamientos como **gráfico barras**. Alertas incluir **caducados** (no solo bajo mínimos). |
| **InventoryTab.jsx** | Tabla materiales: nombre, stock, próx. caducidad, coste unit., acciones. Unidad: uds, dosis, ml, paq, g. | Sin distinción visual **unidad compra vs consumo**. "Coste por tratamiento" pedido en "lista de servicios": TreatmentsTab ya tiene "Coste Mat." por tratamiento; InventoryTab podría mostrar coste estimado por tratamiento en **TreatmentsTab** (reforzar etiqueta) o una columna en lista de tratamientos. |
| **TreatmentsTab.jsx** | Tarjetas con nombre, PVP, Coste Mat., Beneficio. `calculateCost(recipe)`. | Columna/card ya muestra coste material; se puede etiquetar explícitamente "Coste estimado por tratamiento". |
| **calculations.js** | `calculateStats`, `calculateGrowth`, `calculateUnitCost`, `calculateSessionCost`, `getTopTreatments`, `getLowStockItems`. | Falta `calculateTaxReverse(total, rate)` (o delegar a format.js). Falta helper para items **caducados** (expiry_date < hoy). |

### Tablas Supabase inferidas del código

- **profiles** — company_name, name, surname, nif, address, city, collegiate_number, mobile, logo_url, theme_color, etc.
- **clients** — user_id, name, surname, phone, email, notes, has_consent, has_image_rights, drive_url
- **finance_entries** — user_id, date, type, category, description, amount, tax_rate?, base_amount?, tax_amount?, related_cost?, client_id?
- **inventory** — user_id, name, stock, unit, unit_cost, min_stock, etc.
- **inventory_batches** — trazabilidad (lot_number, expiry_date, quantity_remaining)
- **treatments** — user_id, name, price, recipe (JSONB), internal_notes
- **appointments** — citas
- **session_photos**, **recurring_config**

No hay archivos `.sql` en el repo; el esquema se infiere de los `insert`/`update`/`select`.

---

## 1. CAMBIOS DE BASE DE DATOS (SUPABASE)

### 1.1 Tabla `finance_entries`

Objetivo: soportar IVA desglosado, número de factura inalterable y notas internas para sesiones.

```sql
-- Añadir columnas a finance_entries (si no existen)
ALTER TABLE finance_entries
  ADD COLUMN IF NOT EXISTS tax_base numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2) DEFAULT 21,
  ADD COLUMN IF NOT EXISTS total_amount numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- Comentario: total_amount = importe total con IVA (para facturas); amount se mantiene por compatibilidad (puede ser igual a total_amount).
-- invoice_number: formato "F2026-001", asignado al cerrar venta, inalterable.
-- internal_notes: solo para sesiones (type=income, category=Servicio), no se imprime en factura.
```

- **Migración de datos:** Para filas existentes con `type = 'income'` y sin `tax_base`/`tax_amount`, rellenar con `calculateTaxReverse(amount, 21)` y actualizar `tax_rate = 21`, `total_amount = amount`. Las facturas ya emitidas pueden quedarse con `invoice_number` generado a partir de `id`/fecha (script de backfill opcional).

### 1.2 Tabla `invoice_series` (nueva)

Para números correlativos por año y usuario (Verifactu / trazabilidad).

```sql
CREATE TABLE IF NOT EXISTS invoice_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year int NOT NULL,
  last_number int NOT NULL DEFAULT 0,
  UNIQUE(user_id, year)
);

-- RLS
ALTER TABLE invoice_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own series"
  ON invoice_series FOR ALL
  USING (auth.uid() = user_id);
```

- Asignación de número: al insertar una `finance_entry` de tipo ingreso "facturable", hacer `SELECT last_number+1 FROM invoice_series WHERE user_id=? AND year=? FOR UPDATE` (o función/trigger), actualizar `last_number`, formar `invoice_number = 'F' || year || '-' || lpad(last_number, 3, '0')`.

### 1.3 Tabla `clients`

Campos nuevos: NIF, origen, alergias, antecedentes. Opcional renombrar `drive_url` a `drive_folder_url` o mantener ambos (alias en UI).

```sql
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS origin text,  -- 'instagram' | 'google' | 'recommendation' | null
  ADD COLUMN IF NOT EXISTS allergies text,
  ADD COLUMN IF NOT EXISTS medical_history text;

-- drive_url ya existe; si se prefiere drive_folder_url como nombre en app, se puede usar un alias en select o migrar nombre.
```

- **Migración:** Valores por defecto NULL; no requiere backfill.

### 1.4 Tabla `inventory` (opcional)

Distinguir unidad de compra vs consumo (ej. compras en "cajas", consumo en "ml").

```sql
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS unit_purchase text DEFAULT 'uds',  -- uds, caja, paq
  ADD COLUMN IF NOT EXISTS unit_consumption text DEFAULT 'uds'; -- uds, ml, viales, dosis
```

- Si no se añade, se puede seguir usando `unit` y mostrar en UI dos etiquetas (ej. "Compra: caja / Consumo: ml") con un solo campo mapeado.

---

## 2. COMPONENTES A REFACTORIZAR VS NUEVOS

### 2.1 Refactorizar (existentes)

| Componente | Cambios |
|------------|--------|
| **SessionModal.jsx** | Añadir estado y textarea "Notas Internas"; pasar `internal_notes` en `onConfirm`. Mantener lista de materiales prevista y eliminación por ítem (ya está). |
| **FinanceTab.jsx** | Sin cambios estructurales grandes; ya usa base/cuota en formulario manual. Asegurar placeholders "0.00 €" en inputs numéricos. |
| **invoiceGenerator.js** | Incluir desglose IVA (base + cuota); NIF cliente obligatorio en datos y en PDF; placeholder visual para QR Verifactu; usar `invoice_number` si existe, si no fallback a actual. |
| **useSessionMutation.js** | Recibir `internal_notes`; calcular `tax_base`, `tax_amount` con 21% (PVP incluido); asignar `invoice_number` al insertar (servicio `getNextInvoiceNumber`); guardar `tax_base`, `tax_rate`, `total_amount`, `internal_notes` en `finance_entries`. |
| **useFinance.js** | Sin cambios; opcionalmente exponer función/hook para "siguiente número de factura" si se centraliza en cliente. |
| **ClientsTab.jsx** | Transformar modal de edición en **vista de perfil completo con pestañas**: Filiación (datos personales + NIF + Origen), Médico (alergias en textarea destacada roja si no vacío, antecedentes), Legal (checkboxes RGPD, Derechos imagen; input drive_folder_url), Historial (lista existente de sesiones). Reutilizar `useClientHistory` y lógica de fotos. |
| **DashboardTab.jsx** | Sustituir/ampliar KPIs: (1) Facturación mes actual grande vs mes anterior (%); (2) Widget "Hucha de Impuestos" (suma `tax_amount` ingresos del periodo); (3) Top Tratamientos en **gráfico de barras**; (4) Alertas de stock: listado en rojo ítems bajo mínimos **o** con lotes caducados (usar `inventory_batches` o `getEarliestExpiry` y comparar con hoy). |
| **InventoryTab.jsx** | Distinguir visualmente unidad compra vs consumo (columnas o etiquetas). Si se añaden `unit_purchase`/`unit_consumption` en BD, mostrarlas. |
| **TreatmentsTab.jsx** | Dejar explícita la etiqueta "Coste estimado por tratamiento" (ya tiene "Coste Mat."; se puede renombrar o añadir subtítulo). |

### 2.2 Nuevos (crear)

| Componente | Ubicación | Responsabilidad |
|------------|------------|-----------------|
| **calculateTaxReverse** | `src/utils/calculations.js` | `calculateTaxReverse(total, rate)` → `{ baseAmount, taxAmount }` (misma fórmula que `format.calculateTaxFromTotal`, o reexportar desde format para no duplicar). |
| **getNextInvoiceNumber** (servicio o hook) | `src/services/invoiceSeries.js` o `src/hooks/useInvoiceSeries.js` | Obtener siguiente correlativo por user_id y año; actualizar `invoice_series`; devolver string "F2026-001". Llamado desde `useSessionMutation` al crear ingreso facturable. |
| **ClientProfileTabs** (o integrar en ClientsTab) | `src/components/clients/ClientProfileTabs.jsx` (opcional) | Pestañas Filiación / Médico / Legal / Historial para reutilizar en modal o vista detalle. |
| **KPI widgets** (opcional como subcomponentes) | `src/components/dashboard/KpiCard.jsx`, `TaxHuchaCard.jsx`, `TopTreatmentsBarChart.jsx` | Widgets reutilizables para Dashboard estilo Holded. |
| **Bar chart Top Tratamientos** | Dentro de `DashboardTab.jsx` o `src/components/dashboard/TopTreatmentsBarChart.jsx` | Gráfico de barras con datos de `getTopTreatments`. |

### 2.3 Utilidades

| Archivo | Cambios |
|---------|--------|
| **calculations.js** | Añadir `calculateTaxReverse(total, rate)` (o importar desde format y reexportar). Añadir `getExpiredStockItems(inventory, batches)` o extender `getLowStockItems` para incluir ítems con lote caducado. |
| **format.js** | Mantener `calculateTaxFromTotal`; en invoiceGenerator usar mismo criterio (PVP con IVA 21%). |

---

## 3. MIGRACIÓN DE DATOS

### 3.1 finance_entries (facturación e IVA)

1. **Backfill IVA (opcional):** Para todas las filas `type = 'income'` donde `tax_base`/`tax_amount` son NULL, calcular con `calculateTaxReverse(amount, 21)` y actualizar `tax_base`, `tax_amount`, `tax_rate = 21`, `total_amount = amount`.
2. **Series de facturación:** Crear filas en `invoice_series` por cada `(user_id, year)` que exista en `finance_entries` (income), con `last_number` = máximo número ya usado si se genera algún `invoice_number` desde id/fecha, o 0. A partir de ahí, todas las **nuevas** sesiones tendrán número asignado por el nuevo flujo; las antiguas pueden conservar número generado por id/fecha en PDF sin modificar BD.

### 3.2 clients

No requiere migración; columnas nuevas NULL. Si se quiere mostrar "Origen" en listados, rellenar manualmente o dejar vacío.

### 3.3 inventory (unit_purchase / unit_consumption)

Si se añaden columnas, backfill: `unit_purchase = unit`, `unit_consumption = unit` para registros existentes.

### 3.4 Orden de ejecución recomendado

1. Ejecutar SQL de `invoice_series` y políticas RLS.  
2. Añadir columnas a `finance_entries` y `clients` (y opcionalmente `inventory`).  
3. Backfill `finance_entries` (IVA y, si se desea, `invoice_number` histórico).  
4. Desplegar código: primero utilidades y servicio de series; luego SessionModal + useSessionMutation; después invoiceGenerator; después ClientsTab con pestañas; después Dashboard e Inventory/Treatments.

---

## 4. RESUMEN DE PLAN DE ATAQUE

| # | Área | Acción principal |
|---|------|------------------|
| 1 | **DB** | Scripts SQL: `finance_entries` (tax_base, tax_rate, total_amount, invoice_number, internal_notes), `invoice_series`, `clients` (nif, origin, allergies, medical_history), opcional `inventory` (unit_purchase, unit_consumption). |
| 2 | **Cálculos** | `calculateTaxReverse` en `calculations.js`; helper stock caducado. |
| 3 | **Facturación** | Servicio/hook `getNextInvoiceNumber`; uso en `useSessionMutation`; PDF con desglose IVA, NIF cliente, placeholder QR Verifactu. |
| 4 | **SessionModal** | Campo Notas Internas; pasar a `onConfirm`; mutación guardar `internal_notes` y campos IVA + `invoice_number`. |
| 5 | **Cliente 360** | ClientsTab con pestañas Filiación / Médico / Legal / Historial; formulario con NIF, origen, alergias, antecedentes, drive_folder_url. |
| 6 | **Dashboard** | KPI Facturación mes vs anterior; Hucha de Impuestos; Top Tratamientos en gráfico barras; Alertas stock (bajo mínimos + caducados). |
| 7 | **Stock** | InventoryTab: distinción unidad compra/consumo. TreatmentsTab: etiqueta clara "Coste estimado por tratamiento". |
| 8 | **UI/Placeholders** | Inputs numéricos con placeholder "0.00 €"; validaciones y coherencia Tailwind + componentes existentes (AdaptiveModal, LoadingButton, Toast). |

---

## 5. PRÓXIMO PASO

Tras tu **confirmación** de este plan, se procederá a implementar en el orden indicado, empezando por:

1. Scripts SQL listos para ejecutar en Supabase.  
2. Utilidad `calculateTaxReverse` y ajustes en `calculations.js`.  
3. Servicio de series de facturación y cambios en `useSessionMutation` y `SessionModal`.  
4. Actualización de `invoiceGenerator.js`.  
5. Refactor de ClientsTab (perfil 360º) y Dashboard.

Si quieres priorizar un módulo concreto (por ejemplo solo Legal/Facturación o solo Cliente 360), indícalo y se ajusta el orden de ejecución.
