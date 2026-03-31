


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_next_invoice_number"("p_user_id" "uuid", "p_year" integer) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_next int;
  v_series text;
BEGIN
  INSERT INTO invoice_series (user_id, year, last_number)
  VALUES (p_user_id, p_year, 1)
  ON CONFLICT (user_id, year)
  DO UPDATE SET last_number = invoice_series.last_number + 1
  RETURNING last_number INTO v_next;

  v_series := 'F' || p_year || '-' || lpad(v_next::text, 3, '0');
  RETURN v_series;
END;
$$;


ALTER FUNCTION "public"."get_next_invoice_number"("p_user_id" "uuid", "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_rectified_invoice_number"("p_user_id" "uuid", "p_year" integer) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_next int;
BEGIN
  INSERT INTO invoice_series_rectified (user_id, year, last_number)
  VALUES (p_user_id, p_year, 1)
  ON CONFLICT (user_id, year)
  DO UPDATE SET last_number = invoice_series_rectified.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN 'R-' || p_year || '-' || lpad(v_next::text, 2, '0');
END;
$$;


ALTER FUNCTION "public"."get_next_rectified_invoice_number"("p_user_id" "uuid", "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, company_name)
  VALUES (
    new.id, 
    new.email, 
    'Usuario Nuevo', -- Nombre por defecto (luego lo cambias en Settings)
    'Mi Empresa'     -- Empresa por defecto
  );
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "treatment_id" "uuid",
    "finance_entry_id" "uuid",
    "title" "text" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone,
    "type" "text" NOT NULL,
    "notes" "text",
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "all_day" boolean DEFAULT false,
    "status" "text" DEFAULT 'pending'::"text",
    "activo" boolean DEFAULT true NOT NULL,
    CONSTRAINT "appointments_type_check" CHECK (("type" = ANY (ARRAY['appointment'::"text", 'task'::"text"])))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."appointments"."activo" IS 'false = archivada / cancelada lógica';



CREATE TABLE IF NOT EXISTS "public"."bonus_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "treatment_id" "uuid" NOT NULL,
    "total_sessions" integer NOT NULL,
    "default_price" numeric(12,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "bonus_templates_default_price_check" CHECK (("default_price" >= (0)::numeric)),
    CONSTRAINT "bonus_templates_total_sessions_check" CHECK (("total_sessions" > 0))
);


ALTER TABLE "public"."bonus_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."bonus_templates" IS 'Plantillas de bonos (ej. 5 sesiones de Bótox)';



CREATE TABLE IF NOT EXISTS "public"."client_bonuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "treatment_id" "uuid" NOT NULL,
    "total_sessions" integer NOT NULL,
    "used_sessions" integer DEFAULT 0 NOT NULL,
    "price_paid" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_bonuses_check" CHECK ((("used_sessions" >= 0) AND ("used_sessions" <= "total_sessions"))),
    CONSTRAINT "client_bonuses_price_paid_check" CHECK (("price_paid" >= (0)::numeric)),
    CONSTRAINT "client_bonuses_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'exhausted'::"text"]))),
    CONSTRAINT "client_bonuses_total_sessions_check" CHECK (("total_sessions" > 0))
);


ALTER TABLE "public"."client_bonuses" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_bonuses" IS 'Bonos vendidos a clientes; used_sessions se incrementa al consumir en sesión';



CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "surname" "text",
    "email" "text",
    "phone" "text",
    "dni" "text",
    "address" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "has_consent" boolean DEFAULT false,
    "has_image_rights" boolean DEFAULT false,
    "drive_url" "text",
    "nif" "text",
    "origin" "text",
    "allergies" "text",
    "medical_history" "text",
    "fecha_nacimiento" "date",
    "notas_privadas" "text",
    "activo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clients"."fecha_nacimiento" IS 'Fecha de nacimiento del cliente (edad se calcula en frontend)';



COMMENT ON COLUMN "public"."clients"."notas_privadas" IS 'Notas privadas de historia clínica, no exportables';



COMMENT ON COLUMN "public"."clients"."activo" IS 'false = archivado; no mostrar en UI habitual';



CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "provider_name" "text" NOT NULL,
    "provider_nif" "text" NOT NULL,
    "invoice_number" "text",
    "tax_base" numeric(12,2) DEFAULT 0 NOT NULL,
    "tax_rate" numeric(5,2) DEFAULT 21 NOT NULL,
    "tax_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "category" "text" DEFAULT 'General'::"text",
    "description" "text",
    "receipt_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text",
    "category" "text",
    "description" "text",
    "amount" numeric DEFAULT 0,
    "related_cost" numeric DEFAULT 0,
    "is_automatic" boolean DEFAULT false,
    "date" "date" DEFAULT CURRENT_DATE,
    "client_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "tax_rate" numeric DEFAULT 0,
    "tax_amount" numeric DEFAULT 0,
    "base_amount" numeric DEFAULT 0,
    "tax_base" numeric(12,2) DEFAULT NULL::numeric,
    "total_amount" numeric(12,2) DEFAULT NULL::numeric,
    "invoice_number" "text",
    "internal_notes" "text",
    "supplier_nif" "text",
    "file_url" "text",
    "is_deductible" boolean DEFAULT false,
    "plan_amigo" boolean DEFAULT false,
    "irpf_rate" numeric DEFAULT 0,
    "irpf_amount" numeric DEFAULT 0,
    "recurring_id" "uuid",
    "months_paid" integer DEFAULT 1,
    "coverage_start_date" "date",
    "activo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."finance_entries" OWNER TO "postgres";


COMMENT ON COLUMN "public"."finance_entries"."supplier_nif" IS 'NIF/CIF del proveedor (para gastos deducibles)';



COMMENT ON COLUMN "public"."finance_entries"."file_url" IS 'Ruta en bucket recibos de la factura/justificante';



COMMENT ON COLUMN "public"."finance_entries"."is_deductible" IS 'true si es factura deducible (requiere datos fiscales)';



COMMENT ON COLUMN "public"."finance_entries"."plan_amigo" IS 'Si true: ingreso por sesión sin factura (Plan Amigo). No cuenta para fiscalidad/303.';



COMMENT ON COLUMN "public"."finance_entries"."irpf_rate" IS 'Porcentaje de retención IRPF aplicado (ej: 0, 7, 15, 19)';



COMMENT ON COLUMN "public"."finance_entries"."irpf_amount" IS 'Cuota de retención IRPF (Modelo 111/115)';



COMMENT ON COLUMN "public"."finance_entries"."recurring_id" IS 'Gasto fijo que originó este pago (enlace fuerte por UUID)';



COMMENT ON COLUMN "public"."finance_entries"."months_paid" IS 'Meses cubiertos por este pago (ej: 3 = cubre 3 meses desde coverage_start_date o date)';



COMMENT ON COLUMN "public"."finance_entries"."coverage_start_date" IS 'Fecha del primer mes cubierto por el pago (solo fijos; si null se usa date)';



COMMENT ON COLUMN "public"."finance_entries"."activo" IS 'false = movimiento archivado';



CREATE TABLE IF NOT EXISTS "public"."inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "stock" numeric DEFAULT 0,
    "unit" "text" DEFAULT 'uds'::"text",
    "unit_cost" numeric DEFAULT 0,
    "min_stock" numeric DEFAULT 5,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "unit_purchase" "text" DEFAULT 'uds'::"text",
    "unit_consumption" "text" DEFAULT 'uds'::"text",
    "item_type" "text" DEFAULT 'material'::"text" NOT NULL,
    CONSTRAINT "inventory_item_type_check" CHECK (("item_type" = ANY (ARRAY['material'::"text", 'maquina'::"text"])))
);


ALTER TABLE "public"."inventory" OWNER TO "postgres";


COMMENT ON COLUMN "public"."inventory"."item_type" IS 'material: consumible con stock y lotes; maquina: coste por uso (unit_cost €/sesión), sin stock.';



CREATE TABLE IF NOT EXISTS "public"."inventory_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inventory_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lot_number" "text" NOT NULL,
    "expiry_date" "date" NOT NULL,
    "quantity_remaining" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inventory_batches_quantity_remaining_check" CHECK (("quantity_remaining" >= (0)::numeric))
);


ALTER TABLE "public"."inventory_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_series" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "last_number" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."invoice_series" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_series_rectified" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "last_number" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."invoice_series_rectified" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plantillas_consentimiento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "treatment_id" "uuid",
    "nombre" "text" NOT NULL,
    "contenido" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."plantillas_consentimiento" OWNER TO "postgres";


COMMENT ON TABLE "public"."plantillas_consentimiento" IS 'Plantillas de texto para consentimientos informados por tratamiento';



COMMENT ON COLUMN "public"."plantillas_consentimiento"."treatment_id" IS 'Tratamiento asociado; NULL = plantilla genérica';



COMMENT ON COLUMN "public"."plantillas_consentimiento"."contenido" IS 'Texto con variables {{NOMBRE}}, {{APELLIDOS}}, {{DNI}}, {{TRATAMIENTO}}, {{FECHA}}';



CREATE TABLE IF NOT EXISTS "public"."presupuesto_lineas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "presupuesto_id" "uuid" NOT NULL,
    "line_kind" "text" NOT NULL,
    "treatment_id" "uuid",
    "description" "text" NOT NULL,
    "quantity" numeric DEFAULT 1 NOT NULL,
    "unit_price_ttc" numeric DEFAULT 0 NOT NULL,
    "tax_rate" numeric DEFAULT 21 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "original_unit_price_ttc" numeric,
    CONSTRAINT "presupuesto_lineas_line_kind_check" CHECK (("line_kind" = ANY (ARRAY['treatment'::"text", 'extra'::"text"]))),
    CONSTRAINT "presupuesto_lineas_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "presupuesto_lineas_unit_price_ttc_check" CHECK (("unit_price_ttc" >= (0)::numeric))
);


ALTER TABLE "public"."presupuesto_lineas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."presupuesto_lineas"."unit_price_ttc" IS 'Precio unitario con IVA incluido';



COMMENT ON COLUMN "public"."presupuesto_lineas"."original_unit_price_ttc" IS 'Precio unitario original (IVA inc.) para mostrar descuento vs aplicado';



CREATE TABLE IF NOT EXISTS "public"."presupuestos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "notas" "text",
    "valid_until" "date",
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "nombre" "text",
    "discount_mode" "text" DEFAULT 'manual'::"text" NOT NULL,
    "discount_percent" numeric,
    CONSTRAINT "presupuestos_discount_mode_check" CHECK (("discount_mode" = ANY (ARRAY['manual'::"text", 'global_percent'::"text"])))
);


ALTER TABLE "public"."presupuestos" OWNER TO "postgres";


COMMENT ON TABLE "public"."presupuestos" IS 'Presupuestos / cotizaciones guardados';



COMMENT ON COLUMN "public"."presupuestos"."nombre" IS 'Nombre/identificador interno del presupuesto (ej. \"María - labios + botox\")';



COMMENT ON COLUMN "public"."presupuestos"."discount_mode" IS 'manual = precio aplicado por línea; global_percent = aplicar % global (solo informativo, se guarda ya calculado en unit_price_ttc)';



COMMENT ON COLUMN "public"."presupuestos"."discount_percent" IS 'Porcentaje global aplicado (0-100). Se refleja en PDF como descuento total.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "name" "text",
    "surname" "text",
    "mobile" "text",
    "company_name" "text",
    "nif" "text",
    "collegiate_number" "text",
    "address" "text",
    "city" "text",
    "logo_url" "text",
    "theme_color" "text" DEFAULT '#f43f5e'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "dashboard_widgets" "jsonb",
    "consent_signature_url" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."dashboard_widgets" IS 'Array de IDs de widgets activos en el dashboard, en orden. Ej: ["kpi-facturacion","kpi-impuestos",...]. Máximo 8.';



COMMENT ON COLUMN "public"."profiles"."consent_signature_url" IS 'URL de imagen de firma profesional para PDFs de consentimiento; si está vacío, solo se dibuja la línea.';



CREATE TABLE IF NOT EXISTS "public"."recurring_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "amount" numeric NOT NULL,
    "day_of_month" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_deductible" boolean DEFAULT false,
    "tax_rate" numeric DEFAULT 21,
    "irpf_rate" numeric DEFAULT 0,
    CONSTRAINT "recurring_config_day_of_month_check" CHECK ((("day_of_month" >= 1) AND ("day_of_month" <= 31)))
);


ALTER TABLE "public"."recurring_config" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recurring_config"."is_deductible" IS 'Si el pago recurrente suele ser factura deducible';



COMMENT ON COLUMN "public"."recurring_config"."tax_rate" IS 'IVA % por defecto (ej: 21, 10, 4, 0)';



COMMENT ON COLUMN "public"."recurring_config"."irpf_rate" IS 'IRPF % por defecto (ej: 0, 7, 15, 19)';



CREATE TABLE IF NOT EXISTS "public"."seguimientos_cliente" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "tratamientos_interes" "text",
    "fecha_proximo_contacto" "date",
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."seguimientos_cliente" OWNER TO "postgres";


COMMENT ON TABLE "public"."seguimientos_cliente" IS 'Seguimiento y recordatorios por cliente: tratamientos de interés, próxima cita, notas';



COMMENT ON COLUMN "public"."seguimientos_cliente"."tratamientos_interes" IS 'Tratamientos de interés (texto libre o lista separada por comas)';



COMMENT ON COLUMN "public"."seguimientos_cliente"."fecha_proximo_contacto" IS 'Fecha prevista para próximo contacto o recordatorio';



CREATE TABLE IF NOT EXISTS "public"."session_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "finance_entry_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "session_photos_type_check" CHECK (("type" = ANY (ARRAY['before'::"text", 'after'::"text"])))
);


ALTER TABLE "public"."session_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signed_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "treatment_id" "uuid",
    "treatment_name" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."signed_consents" OWNER TO "postgres";


COMMENT ON TABLE "public"."signed_consents" IS 'PDFs de consentimientos informados firmados por cliente';



COMMENT ON COLUMN "public"."signed_consents"."treatment_name" IS 'Nombre del tratamiento (para listado aunque treatment_id sea NULL)';



COMMENT ON COLUMN "public"."signed_consents"."storage_path" IS 'Ruta en bucket signed-consents';



CREATE TABLE IF NOT EXISTS "public"."treatment_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."treatment_groups" OWNER TO "postgres";


COMMENT ON TABLE "public"."treatment_groups" IS 'Grupos para agrupar tratamientos (ej. Mesoterapia, Limpiezas)';



CREATE TABLE IF NOT EXISTS "public"."treatments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric NOT NULL,
    "recipe" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "internal_notes" "text",
    "group_id" "uuid",
    "activo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."treatments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."treatments"."group_id" IS 'Grupo al que pertenece el tratamiento; null = sin grupo';



COMMENT ON COLUMN "public"."treatments"."activo" IS 'false = archivado';



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bonus_templates"
    ADD CONSTRAINT "bonus_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_bonuses"
    ADD CONSTRAINT "client_bonuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_entries"
    ADD CONSTRAINT "finance_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_batches"
    ADD CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_series"
    ADD CONSTRAINT "invoice_series_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_series_rectified"
    ADD CONSTRAINT "invoice_series_rectified_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_series_rectified"
    ADD CONSTRAINT "invoice_series_rectified_user_id_year_key" UNIQUE ("user_id", "year");



ALTER TABLE ONLY "public"."invoice_series"
    ADD CONSTRAINT "invoice_series_user_id_year_key" UNIQUE ("user_id", "year");



ALTER TABLE ONLY "public"."plantillas_consentimiento"
    ADD CONSTRAINT "plantillas_consentimiento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."presupuesto_lineas"
    ADD CONSTRAINT "presupuesto_lineas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."presupuestos"
    ADD CONSTRAINT "presupuestos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_config"
    ADD CONSTRAINT "recurring_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seguimientos_cliente"
    ADD CONSTRAINT "seguimientos_cliente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_photos"
    ADD CONSTRAINT "session_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signed_consents"
    ADD CONSTRAINT "signed_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."treatment_groups"
    ADD CONSTRAINT "treatment_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."treatments"
    ADD CONSTRAINT "treatments_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_appointments_client_id" ON "public"."appointments" USING "btree" ("client_id");



CREATE INDEX "idx_appointments_start_at" ON "public"."appointments" USING "btree" ("start_at");



CREATE INDEX "idx_appointments_status" ON "public"."appointments" USING "btree" ("status");



CREATE INDEX "idx_appointments_user_activo" ON "public"."appointments" USING "btree" ("user_id") WHERE ("activo" = true);



CREATE INDEX "idx_appointments_user_id" ON "public"."appointments" USING "btree" ("user_id");



CREATE INDEX "idx_bonus_templates_treatment" ON "public"."bonus_templates" USING "btree" ("treatment_id");



CREATE INDEX "idx_bonus_templates_user" ON "public"."bonus_templates" USING "btree" ("user_id");



CREATE INDEX "idx_client_bonuses_client" ON "public"."client_bonuses" USING "btree" ("client_id");



CREATE INDEX "idx_client_bonuses_client_treatment_active" ON "public"."client_bonuses" USING "btree" ("client_id", "treatment_id", "status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_client_bonuses_user" ON "public"."client_bonuses" USING "btree" ("user_id");



CREATE INDEX "idx_clients_user_activo" ON "public"."clients" USING "btree" ("user_id") WHERE ("activo" = true);



CREATE INDEX "idx_expenses_user_date" ON "public"."expenses" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_finance_entries_client_id" ON "public"."finance_entries" USING "btree" ("client_id");



CREATE INDEX "idx_finance_entries_deductible" ON "public"."finance_entries" USING "btree" ("user_id", "is_deductible", "date" DESC) WHERE ("is_deductible" = true);



CREATE INDEX "idx_finance_entries_invoice_number" ON "public"."finance_entries" USING "btree" ("user_id", "invoice_number") WHERE ("invoice_number" IS NOT NULL);



CREATE INDEX "idx_finance_entries_plan_amigo" ON "public"."finance_entries" USING "btree" ("user_id", "plan_amigo") WHERE ("plan_amigo" = true);



CREATE INDEX "idx_finance_entries_recurring_id" ON "public"."finance_entries" USING "btree" ("recurring_id");



CREATE INDEX "idx_finance_entries_user_activo" ON "public"."finance_entries" USING "btree" ("user_id") WHERE ("activo" = true);



CREATE INDEX "idx_inventory_batches_expiry" ON "public"."inventory_batches" USING "btree" ("expiry_date");



CREATE INDEX "idx_inventory_batches_inventory" ON "public"."inventory_batches" USING "btree" ("inventory_id");



CREATE INDEX "idx_inventory_batches_user" ON "public"."inventory_batches" USING "btree" ("user_id");



CREATE INDEX "idx_inventory_item_type" ON "public"."inventory" USING "btree" ("user_id", "item_type");



CREATE INDEX "idx_plantillas_consentimiento_treatment_id" ON "public"."plantillas_consentimiento" USING "btree" ("treatment_id");



CREATE INDEX "idx_plantillas_consentimiento_user_id" ON "public"."plantillas_consentimiento" USING "btree" ("user_id");



CREATE INDEX "idx_presupuesto_lineas_presupuesto" ON "public"."presupuesto_lineas" USING "btree" ("presupuesto_id");



CREATE INDEX "idx_presupuestos_client_id" ON "public"."presupuestos" USING "btree" ("client_id");



CREATE INDEX "idx_presupuestos_user_id" ON "public"."presupuestos" USING "btree" ("user_id");



CREATE INDEX "idx_seguimientos_cliente_client_id" ON "public"."seguimientos_cliente" USING "btree" ("client_id");



CREATE INDEX "idx_seguimientos_cliente_fecha" ON "public"."seguimientos_cliente" USING "btree" ("fecha_proximo_contacto");



CREATE INDEX "idx_seguimientos_cliente_user_id" ON "public"."seguimientos_cliente" USING "btree" ("user_id");



CREATE INDEX "idx_session_photos_client_id" ON "public"."session_photos" USING "btree" ("client_id");



CREATE INDEX "idx_session_photos_finance_entry_id" ON "public"."session_photos" USING "btree" ("finance_entry_id");



CREATE INDEX "idx_session_photos_user_id" ON "public"."session_photos" USING "btree" ("user_id");



CREATE INDEX "idx_signed_consents_client_id" ON "public"."signed_consents" USING "btree" ("client_id");



CREATE INDEX "idx_signed_consents_user_id" ON "public"."signed_consents" USING "btree" ("user_id");



CREATE INDEX "idx_treatment_groups_user" ON "public"."treatment_groups" USING "btree" ("user_id");



CREATE INDEX "idx_treatments_group_id" ON "public"."treatments" USING "btree" ("group_id");



CREATE INDEX "idx_treatments_user_activo" ON "public"."treatments" USING "btree" ("user_id") WHERE ("activo" = true);



CREATE OR REPLACE TRIGGER "appointments_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_finance_entry_id_fkey" FOREIGN KEY ("finance_entry_id") REFERENCES "public"."finance_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bonus_templates"
    ADD CONSTRAINT "bonus_templates_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bonus_templates"
    ADD CONSTRAINT "bonus_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_bonuses"
    ADD CONSTRAINT "client_bonuses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_bonuses"
    ADD CONSTRAINT "client_bonuses_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."bonus_templates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."client_bonuses"
    ADD CONSTRAINT "client_bonuses_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."client_bonuses"
    ADD CONSTRAINT "client_bonuses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_entries"
    ADD CONSTRAINT "finance_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_entries"
    ADD CONSTRAINT "finance_entries_recurring_id_fkey" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_config"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_entries"
    ADD CONSTRAINT "finance_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inventory_batches"
    ADD CONSTRAINT "inventory_batches_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_series_rectified"
    ADD CONSTRAINT "invoice_series_rectified_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_series"
    ADD CONSTRAINT "invoice_series_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plantillas_consentimiento"
    ADD CONSTRAINT "plantillas_consentimiento_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."presupuesto_lineas"
    ADD CONSTRAINT "presupuesto_lineas_presupuesto_id_fkey" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuestos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."presupuesto_lineas"
    ADD CONSTRAINT "presupuesto_lineas_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."presupuestos"
    ADD CONSTRAINT "presupuestos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_config"
    ADD CONSTRAINT "recurring_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seguimientos_cliente"
    ADD CONSTRAINT "seguimientos_cliente_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_photos"
    ADD CONSTRAINT "session_photos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_photos"
    ADD CONSTRAINT "session_photos_finance_entry_id_fkey" FOREIGN KEY ("finance_entry_id") REFERENCES "public"."finance_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_photos"
    ADD CONSTRAINT "session_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signed_consents"
    ADD CONSTRAINT "signed_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signed_consents"
    ADD CONSTRAINT "signed_consents_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."treatment_groups"
    ADD CONSTRAINT "treatment_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."treatments"
    ADD CONSTRAINT "treatments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."treatment_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."treatments"
    ADD CONSTRAINT "treatments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can crud own config" ON "public"."recurring_config" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can crud own inventory" ON "public"."inventory" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can crud own treatments" ON "public"."treatments" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage own appointments" ON "public"."appointments" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own batches" ON "public"."inventory_batches" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own client follow-ups" ON "public"."seguimientos_cliente" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own consent templates" ON "public"."plantillas_consentimiento" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own session photos" ON "public"."session_photos" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own signed consents" ON "public"."signed_consents" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users manage own bonus_templates" ON "public"."bonus_templates" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own client_bonuses" ON "public"."client_bonuses" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own clients" ON "public"."clients" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own expenses" ON "public"."expenses" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own finance_entries" ON "public"."finance_entries" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own inventory" ON "public"."inventory" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own invoice series" ON "public"."invoice_series" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own presupuesto_lineas" ON "public"."presupuesto_lineas" USING ((EXISTS ( SELECT 1
   FROM "public"."presupuestos" "p"
  WHERE (("p"."id" = "presupuesto_lineas"."presupuesto_id") AND ("p"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."presupuestos" "p"
  WHERE (("p"."id" = "presupuesto_lineas"."presupuesto_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users manage own presupuestos" ON "public"."presupuestos" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own profiles" ON "public"."profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users manage own rectified series" ON "public"."invoice_series_rectified" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own recurring_config" ON "public"."recurring_config" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own treatment_groups" ON "public"."treatment_groups" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own treatments" ON "public"."treatments" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bonus_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_bonuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_series" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_series_rectified" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plantillas_consentimiento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."presupuesto_lineas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."presupuestos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seguimientos_cliente" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signed_consents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."treatment_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."treatments" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."get_next_invoice_number"("p_user_id" "uuid", "p_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_invoice_number"("p_user_id" "uuid", "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_invoice_number"("p_user_id" "uuid", "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_rectified_invoice_number"("p_user_id" "uuid", "p_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_rectified_invoice_number"("p_user_id" "uuid", "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_rectified_invoice_number"("p_user_id" "uuid", "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."bonus_templates" TO "anon";
GRANT ALL ON TABLE "public"."bonus_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."bonus_templates" TO "service_role";



GRANT ALL ON TABLE "public"."client_bonuses" TO "anon";
GRANT ALL ON TABLE "public"."client_bonuses" TO "authenticated";
GRANT ALL ON TABLE "public"."client_bonuses" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."finance_entries" TO "anon";
GRANT ALL ON TABLE "public"."finance_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_entries" TO "service_role";



GRANT ALL ON TABLE "public"."inventory" TO "anon";
GRANT ALL ON TABLE "public"."inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_batches" TO "anon";
GRANT ALL ON TABLE "public"."inventory_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_batches" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_series" TO "anon";
GRANT ALL ON TABLE "public"."invoice_series" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_series" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_series_rectified" TO "anon";
GRANT ALL ON TABLE "public"."invoice_series_rectified" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_series_rectified" TO "service_role";



GRANT ALL ON TABLE "public"."plantillas_consentimiento" TO "anon";
GRANT ALL ON TABLE "public"."plantillas_consentimiento" TO "authenticated";
GRANT ALL ON TABLE "public"."plantillas_consentimiento" TO "service_role";



GRANT ALL ON TABLE "public"."presupuesto_lineas" TO "anon";
GRANT ALL ON TABLE "public"."presupuesto_lineas" TO "authenticated";
GRANT ALL ON TABLE "public"."presupuesto_lineas" TO "service_role";



GRANT ALL ON TABLE "public"."presupuestos" TO "anon";
GRANT ALL ON TABLE "public"."presupuestos" TO "authenticated";
GRANT ALL ON TABLE "public"."presupuestos" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_config" TO "anon";
GRANT ALL ON TABLE "public"."recurring_config" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_config" TO "service_role";



GRANT ALL ON TABLE "public"."seguimientos_cliente" TO "anon";
GRANT ALL ON TABLE "public"."seguimientos_cliente" TO "authenticated";
GRANT ALL ON TABLE "public"."seguimientos_cliente" TO "service_role";



GRANT ALL ON TABLE "public"."session_photos" TO "anon";
GRANT ALL ON TABLE "public"."session_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."session_photos" TO "service_role";



GRANT ALL ON TABLE "public"."signed_consents" TO "anon";
GRANT ALL ON TABLE "public"."signed_consents" TO "authenticated";
GRANT ALL ON TABLE "public"."signed_consents" TO "service_role";



GRANT ALL ON TABLE "public"."treatment_groups" TO "anon";
GRANT ALL ON TABLE "public"."treatment_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."treatment_groups" TO "service_role";



GRANT ALL ON TABLE "public"."treatments" TO "anon";
GRANT ALL ON TABLE "public"."treatments" TO "authenticated";
GRANT ALL ON TABLE "public"."treatments" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Users can delete own receipts"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'recibos'::text) AND (name ~~ (('receipts/'::text || (auth.uid())::text) || '/%'::text))));



  create policy "Users can delete own session photos"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'session-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can delete signed consents in own folder"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'signed-consents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can read own receipts"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'recibos'::text) AND (name ~~ (('receipts/'::text || (auth.uid())::text) || '/%'::text))));



  create policy "Users can read own session photos"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'session-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can read signed consents in own folder"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'signed-consents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can update own receipts"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'recibos'::text) AND (name ~~ (('receipts/'::text || (auth.uid())::text) || '/%'::text))))
with check (((bucket_id = 'recibos'::text) AND (name ~~ (('receipts/'::text || (auth.uid())::text) || '/%'::text))));



  create policy "Users can upload own receipts"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'recibos'::text) AND (name ~~ (('receipts/'::text || (auth.uid())::text) || '/%'::text))));



  create policy "Users can upload own session photos"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'session-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can upload signed consents in own folder"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'signed-consents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "company_assets_delete_own_folder"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'company-assets'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "company_assets_insert_own_folder"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'company-assets'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "company_assets_select_public"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'company-assets'::text));



