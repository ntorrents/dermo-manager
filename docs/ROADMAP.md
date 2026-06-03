# Roadmap oficial — Dermo Manager ERP

Documento de referencia para priorización de desarrollo.  
**Última revisión:** junio 2026.

**Fuera de alcance activo:** integración **Verifactu** / envío AEAT en tiempo real (reservado para fase futura, sin fecha).

---

## Leyenda de estado

| Símbolo | Significado |
|---------|-------------|
| ✅ | Hecho |
| 🔄 | Parcial / en curso |
| ⬜ | Pendiente |
| 🏥 | Solo necesario para otras verticales (vet, dental, fisio…) |

---

## Fase 0 — Deuda y cierre del plan anterior

Objetivo: cerrar lo empezado y dejar la base estable antes de nuevas features.

| # | Ítem | Estado | Notas |
|---|------|--------|-------|
| 0.1 | Migración B2B/IVA tratamientos en producción (`20260601120000_…`) | ⬜ | `is_company`, `irpf_withholding_rate`, `treatments.tax_rate` |
| 0.2 | Actualizar `PLAN_6_BLOQUES.md` o archivarlo (sustituido por este roadmap) | ⬜ | Bloques 1–3 ✅; 4–6 parciales |
| 0.3 | Soft-delete coherente (`activo`) en todas las tablas críticas | 🔄 | Ya en `clients`, `finance_entries`; revisar `treatments`, `appointments`, inventario |
| 0.4 | Widget alertas stock **fijo** en dashboard (bloque 5 antiguo) | ⬜ | Stock bajo + caducidades arriba del grid de widgets |
| 0.5 | Contraste tipográfico en pantallas principales | ⬜ | Accesibilidad / lectura en móvil |
| 0.6 | Tests automáticos mínimos (fiscal, facturas, checklist) | ⬜ | `incomeTax`, `invoiceAnalytics`, `financeIssues`, series |
| 0.7 | TypeScript gradual en `utils/` fiscal y facturación | ⬜ | Reducir errores en cálculos |

---

## Fase 1 — Operativa diaria (clínica dermo, **ahora**)

Objetivo: menos clics en mostrador, menos errores al cobrar y facturar.

| # | Ítem | Estado | Descripción |
|---|------|--------|-------------|
| 1.1 | Finanzas **modo básico** vs avanzado | ⬜ | Básico: hoy/semana/mes, ingresos/gastos, pocos campos. Avanzado: deducible, amortización, inversión |
| 1.2 | **Cierre de caja diario** | ⬜ | Total cobrado del día vs movimientos; diferencia visible |
| 1.3 | Cliente → **Ver sus facturas** | ⬜ | Enlace a pestaña Facturas con filtro preaplicado |
| 1.4 | Enviar factura **PDF** (email / descarga rápida) | ⬜ | Desde Facturas y post-sesión; plantilla asunto/cuerpo |
| 1.5 | Alertas dashboard unificadas | ⬜ | Citas hoy, seguimientos vencidos, stock, caducidades |
| 1.6 | Recordatorio seguimiento | ⬜ | Notificación navegador o email en `fecha_proximo_contacto` |
| 1.7 | Aviso al facturar **empresa sin dirección fiscal** | 🔄 | Validación en ficha ✅; falta en sesión/agenda antes de cobrar |
| 1.8 | Presupuesto → sesión → factura (1 clic) | ⬜ | Desde Documentos/Presupuestos cuando el cliente acepta |
| 1.9 | Proveedores: **merge guiado** + reglas persistentes | 🔄 | Unificar duplicados NIF/nombre; reglas en BD (hoy parcial en localStorage) |
| 1.10 | Directorio proveedores único | 🔄 | Misma fuente en Finanzas, Stock y Proveedores (util compartido ✅; ampliar datos) |

---

## Fase 2 — Fiscalidad y trazabilidad (sin Verifactu)

Objetivo: contentar asesoría y auditoría interna con evidencias claras.

| # | Ítem | Estado | Descripción |
|---|------|--------|-------------|
| 2.1 | **Archivar PDF** al emitir factura (Storage) | ⬜ | Copia oficial en servidor; re-descarga sin regenerar en cliente |
| 2.2 | **Libro de facturas emitidas** exportable | 🔄 | Listado en Facturas ✅; falta export CSV/PDF “libro diario” con totales |
| 2.3 | Control **huecos de numeración** | ⬜ | Pantalla: último F/R por año, saltos, sesiones sin número por fallo RPC |
| 2.4 | Bloquear o reintentar si **falla serie factura** | ⬜ | Hoy la sesión puede guardarse sin `invoice_number` |
| 2.5 | **Rectificativas guiadas** (abono) | 🔄 | Abono con serie R ✅; falta wizard: factura origen, motivo, enlace `rectifies_entry_id` |
| 2.6 | Inmutabilidad post-factura | ⬜ | Tras numerar: no editar importes; solo abono o notas internas |
| 2.7 | Resumen **Modelo 111** (retenciones practicadas) | ⬜ | Suma `irpf_amount` por trimestre en Fiscalidad |
| 2.8 | Informe **IVA exento vs 21%** por periodo | ⬜ | Por tratamiento / categoría sanitario vs estético |
| 2.9 | Checklist **pre-cierre trimestre** ampliado | 🔄 | Fiscalidad → Finanzas ✅; añadir: sin PDF archivado, huecos numeración |
| 2.10 | Conciliación **bancaria** (import CSV) | ⬜ | Marcar movimientos conciliados vs extracto |
| 2.11 | Compras stock sin factura deducible | ✅ | Modo farmacia / trazabilidad mínima |
| 2.12 | PVP + IRPF empresa | ✅ | Lógica fiscal sesiones y PDF |
| 2.13 | Pestaña **Facturas** (filtros, stats, PDF) | ✅ | |

---

## Fase 3 — Calidad, seguridad y RGPD

Objetivo: robustez multi-usuario y cumplimiento datos personales.

| # | Ítem | Estado | Descripción |
|---|------|--------|-------------|
| 3.1 | **Roles** finos (recepción / sanitario / admin / asesor lectura) | 🔄 | RBAC y planes existen; falta matriz en UI |
| 3.2 | Export **RGPD** por paciente (ZIP) | ⬜ | Datos + fotos + consentimientos + historial |
| 3.3 | Política retención fotos / datos | ⬜ | Config clínica + aviso caducidad |
| 3.4 | Auditoría: ampliar entidades críticas | 🔄 | Log admin ✅; incluir cambios en facturas e importes |
| 3.5 | Backup: aviso “último backup hace X días” | ⬜ | Export manual ✅ en Ajustes |
| 3.6 | Inventario: validaciones trazabilidad unificadas | ⬜ | Alta, reposición y finanzas con mismas reglas documentadas |

---

## Fase 4 — Informes y crecimiento (dermo)

Objetivo: decisiones de negocio sin salir del ERP.

| # | Ítem | Estado | Descripción |
|---|------|--------|-------------|
| 4.1 | Facturación por **profesional** | ⬜ | Si hay varios usuarios/clínica |
| 4.2 | Facturación por **origen** de cliente | ⬜ | Instagram, Google, recomendación… |
| 4.3 | Margen por tratamiento (PVP − coste material) | 🔄 | Coste sesión en movimiento ✅; informe agregado |
| 4.4 | Comparativa periodos (mes vs mes anterior) | ⬜ | Dashboard o Facturas |
| 4.5 | Config clínica: textos pie factura, IVA/IRPF por defecto | ⬜ | Ajustes → Facturación |
| 4.6 | Integración **TPV / datáfono** | ⬜ | Largo plazo; registro cobro automático |

---

## Fase 5 — Multi-vertical 🏥 (vet, dental, fisio…)

**No prioritario para dermo estética actual.** Implementar cuando haya producto o plan específico por sector.

| # | Ítem | Vertical | Descripción |
|---|------|----------|-------------|
| 5.1 | Ficha **mascota + tutor** | 🏥 Vet | Paciente animal vinculado a dueño (facturación al tutor) |
| 5.2 | Cartilla **vacunas / desparasitación** | 🏥 Vet | Historial clínico animal |
| 5.3 | **Odontograma** | 🏥 Dental | Piezas, tratamientos por diente |
| 5.4 | **Bonos de sesiones** (pack 10) | 🏥 Fisio | Consumo 1/N; caducidad bono |
| 5.5 | Valoración fisio (EVA, zonas, objetivos) | 🏥 Fisio | Campos clínicos específicos |
| 5.6 | Config **vertical** al crear clínica | 🏥 Todas | Plantillas UI, campos, informes por sector |
| 5.7 | Informes sectoriales (cartilla vacunas, plan tratamiento dental…) | 🏥 Todas | PDFs distintos por vertical |
| 5.8 | Multi-especie / multi-profesional por cita | 🏥 Vet / Dental | Recursos (sillón, box) |
| 5.9 | Medicamentos **controlados** / receta | 🏥 Vet / Dental | Trazabilidad reforzada |
| 5.10 | Portal **paciente** (citas, consentimiento online) | 🏥 Todas | Autogestión |

---

## Fase futura (sin fecha) — Verifactu

| Ítem | Notas |
|------|-------|
| Registro facturación AEAT | QR, hash, envío; código placeholder en `invoiceGenerator.js` (`ENABLE_VERIFACTU_QR`) |
| Factura electrónica obligatoria | Activar cuando la normativa y el proveedor técnico estén definidos |

**No incluir en sprints hasta decisión explícita.**

---

## Resumen por prioridad inmediata

### Hacer **ya** (Fase 0 + 1 + partes de 2)

1. Migración B2B/IVA en producción (0.1)  
2. Finanzas básico/avanzado (1.1)  
3. Cliente → Facturas (1.3)  
4. Archivar PDF al emitir (2.1)  
5. Huecos numeración + fallo RPC serie (2.3, 2.4)  
6. Widget alertas dashboard (0.4 / 1.5)  
7. Modelo 111 resumen trimestre (2.7)  
8. Proveedores merge (1.9)  

### Después (Fase 2 resto + 3 + 4)

- Conciliación bancaria, rectificativas guiadas, RGPD export, roles, informes negocio.

### Más adelante (Fase 5 🏥)

- Solo si se comercializa hacia vet, dental o fisio.

---

## Referencias

- Plan histórico: `docs/PLAN_6_BLOQUES.md`  
- Fiscal sesiones: `src/utils/incomeTax.js`  
- Facturas UI: `src/components/invoices/InvoicesTab.jsx`  
- Checklist fiscal: `src/components/taxes/TaxesTab.jsx` + `src/utils/financeIssues.js`

---

## Cómo usar este documento

1. Elegir ítems de la fase activa.  
2. Marcar ✅ al cerrar (PR + prueba manual).  
3. No mezclar Fase 5 con entregas dermo sin acuerdo de producto.  
4. Verifactu: ignorar hasta nueva sección explícita en este archivo.
