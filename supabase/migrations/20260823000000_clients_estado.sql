-- Migration: Add 'estado' column to clients table
-- Date: 2026-08-23

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS estado text DEFAULT 'activo';

-- Optionally, backfill existing nulls if any exist
UPDATE public.clients SET estado = 'activo' WHERE estado IS NULL;
