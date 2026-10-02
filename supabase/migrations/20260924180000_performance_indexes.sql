-- Fase 3 rendimiento: índices B-Tree faltantes (FKs + filtros masivos).
-- CREATE INDEX IF NOT EXISTS es idempotente para PRE/PRO.

-- ---------------------------------------------------------------------------
-- Filtros multi-tenant por fecha / agenda (críticos)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_finance_entries_clinic_date
  ON public.finance_entries USING btree (clinic_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_finance_entries_clinic_supplier_nif
  ON public.finance_entries USING btree (clinic_id, supplier_nif)
  WHERE supplier_nif IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_entries_clinic_withholding
  ON public.finance_entries USING btree (clinic_id, withholding_kind, date DESC)
  WHERE withholding_kind IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_clinic_date
  ON public.expenses USING btree (clinic_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_start_at
  ON public.appointments USING btree (clinic_id, start_at);

-- ---------------------------------------------------------------------------
-- FKs sin índice leading (joins / ON DELETE)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_appointments_treatment_id
  ON public.appointments USING btree (treatment_id)
  WHERE treatment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_finance_entry_id
  ON public.appointments USING btree (finance_entry_id)
  WHERE finance_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_bonuses_template_id
  ON public.client_bonuses USING btree (template_id)
  WHERE template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_bonuses_treatment_id
  ON public.client_bonuses USING btree (treatment_id)
  WHERE treatment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_google_calendar_connections_clinic_id
  ON public.google_calendar_connections USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_invoice_series_user_id
  ON public.invoice_series USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_invoice_series_rectified_user_id
  ON public.invoice_series_rectified USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_presupuesto_lineas_treatment_id
  ON public.presupuesto_lineas USING btree (treatment_id)
  WHERE treatment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_config_user_id
  ON public.recurring_config USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_signed_consents_treatment_id
  ON public.signed_consents USING btree (treatment_id)
  WHERE treatment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tax_declarations_presented_by
  ON public.tax_declarations USING btree (presented_by)
  WHERE presented_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id
  ON public.audit_log USING btree (user_id)
  WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Compuestos útiles en ficha cliente / fotos
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_session_photos_clinic_client
  ON public.session_photos USING btree (clinic_id, client_id);

CREATE INDEX IF NOT EXISTS idx_signed_consents_clinic_client
  ON public.signed_consents USING btree (clinic_id, client_id);

CREATE INDEX IF NOT EXISTS idx_presupuestos_clinic_client
  ON public.presupuestos USING btree (clinic_id, client_id);

CREATE INDEX IF NOT EXISTS idx_tax_declarations_clinic_status
  ON public.tax_declarations USING btree (clinic_id, status, year DESC);
