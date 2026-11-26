-- Security hardening follow-up.
-- This migration is committed to the development branch only.
-- Do not apply to Production without a reviewed release and explicit approval.

-- 1) app_private is an internal schema. Keep its tables inaccessible to
-- client roles at the RLS layer as defense in depth. The tables are owned by
-- postgres; vetted SECURITY DEFINER routines are also owned by postgres.
-- RLS is enabled but not FORCEd, so those trusted owner routines retain access.
ALTER TABLE app_private.owner_principal ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.owner_recovery_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.owner_recovery_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.sku_registry ENABLE ROW LEVEL SECURITY;

-- No client-facing policies are intentionally created for these internal tables.
-- Existing table ACLs remain unchanged (anon/authenticated have no table DML grants).

-- 2) Refund evidence: split permissions by SQL command. A FOR ALL policy with
-- a broad USING clause also grants DELETE to view-only users because DELETE
-- does not evaluate WITH CHECK.
DROP POLICY IF EXISTS admins_manage_refund_evidence ON storage.objects;

CREATE POLICY admins_view_refund_evidence
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'refund-evidence'
  AND (
    app_private.has_permission('refunds.view')
    OR app_private.has_permission('refunds.manage')
  )
);

CREATE POLICY admins_upload_refund_evidence
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'refund-evidence'
  AND app_private.has_permission('refunds.manage')
);

CREATE POLICY admins_update_refund_evidence
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'refund-evidence'
  AND app_private.has_permission('refunds.manage')
)
WITH CHECK (
  bucket_id = 'refund-evidence'
  AND app_private.has_permission('refunds.manage')
);

CREATE POLICY admins_delete_refund_evidence
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'refund-evidence'
  AND app_private.has_permission('refunds.manage')
);

-- 3) Define the canonical minimum shipping-address contract used by checkout:
-- address_line_1, city, and country_code must be present and non-blank.
-- Optional fields (e.g. address_line_2, region_code, postal_code) remain optional.
CREATE OR REPLACE FUNCTION public.request_shipping_address_change(
  p_order_id uuid,
  p_recipient_name text,
  p_recipient_phone text,
  p_address jsonb,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND user_id = v_user
  FOR UPDATE;

  IF NOT FOUND OR v_order.order_status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending orders can request address changes';
  END IF;

  IF nullif(btrim(p_recipient_name), '') IS NULL
     OR nullif(btrim(p_recipient_phone), '') IS NULL
     OR jsonb_typeof(p_address) IS DISTINCT FROM 'object'
     OR coalesce(nullif(btrim(p_address->>'address_line_1'), ''), '') = ''
     OR coalesce(nullif(btrim(p_address->>'city'), ''), '') = ''
     OR coalesce(nullif(btrim(p_address->>'country_code'), ''), '') = '' THEN
    RAISE EXCEPTION 'Complete recipient and address details are required';
  END IF;

  INSERT INTO public.order_shipping_change_requests(
    order_id,
    user_id,
    original_recipient_name,
    original_recipient_phone,
    original_shipping_address,
    requested_recipient_name,
    requested_recipient_phone,
    requested_shipping_address,
    customer_reason
  )
  VALUES (
    v_order.id,
    v_user,
    v_order.recipient_name,
    v_order.recipient_phone,
    v_order.shipping_address,
    btrim(p_recipient_name),
    btrim(p_recipient_phone),
    p_address,
    p_reason
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- Enforce the same address contract at the data layer, including against
-- future privileged writes. Existing Production rows were checked read-only:
-- zero invalid orders and zero invalid original/requested change-request addresses.
ALTER TABLE public.orders
  ADD CONSTRAINT orders_shipping_address_required_fields_chk
  CHECK (
    jsonb_typeof(shipping_address) = 'object'
    AND coalesce(nullif(btrim(shipping_address->>'address_line_1'), ''), '') <> ''
    AND coalesce(nullif(btrim(shipping_address->>'city'), ''), '') <> ''
    AND coalesce(nullif(btrim(shipping_address->>'country_code'), ''), '') <> ''
  );

ALTER TABLE public.order_shipping_change_requests
  ADD CONSTRAINT order_shipping_change_original_address_required_fields_chk
  CHECK (
    jsonb_typeof(original_shipping_address) = 'object'
    AND coalesce(nullif(btrim(original_shipping_address->>'address_line_1'), ''), '') <> ''
    AND coalesce(nullif(btrim(original_shipping_address->>'city'), ''), '') <> ''
    AND coalesce(nullif(btrim(original_shipping_address->>'country_code'), ''), '') <> ''
  ),
  ADD CONSTRAINT order_shipping_change_requested_address_required_fields_chk
  CHECK (
    jsonb_typeof(requested_shipping_address) = 'object'
    AND coalesce(nullif(btrim(requested_shipping_address->>'address_line_1'), ''), '') <> ''
    AND coalesce(nullif(btrim(requested_shipping_address->>'city'), ''), '') <> ''
    AND coalesce(nullif(btrim(requested_shipping_address->>'country_code'), ''), '') <> ''
  );

-- 4) Never synthesize a non-MYR shipping price with an implicit FX rate of 1.
-- Active currencies without a configured positive rate have their stale
-- converted row removed; MYR continues to use the base MYR fields.
CREATE OR REPLACE FUNCTION public.sync_shipping_rate_currency_prices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT
      sc.code,
      er.rate AS fx
    FROM public.store_currencies sc
    LEFT JOIN public.currency_exchange_rates er
      ON er.currency_code = sc.code
     AND er.is_configured = true
     AND er.rate > 0
    WHERE sc.is_active = true
  LOOP
    IF c.code <> 'MYR' AND c.fx IS NULL THEN
      DELETE FROM public.shipping_rate_currency_prices
      WHERE shipping_rate_id = NEW.id
        AND currency_code = c.code;
      CONTINUE;
    END IF;

    INSERT INTO public.shipping_rate_currency_prices(
      shipping_rate_id,
      currency_code,
      base_fee,
      additional_fee,
      flat_fee,
      volume_fee_per_litre,
      per_item_fee,
      updated_at,
      updated_by
    )
    VALUES (
      NEW.id,
      c.code,
      CASE WHEN c.code = 'MYR' THEN NEW.base_fee_myr ELSE NEW.base_fee_myr * c.fx END,
      CASE WHEN c.code = 'MYR' THEN NEW.additional_fee_myr ELSE NEW.additional_fee_myr * c.fx END,
      CASE WHEN c.code = 'MYR' THEN NEW.flat_fee_myr ELSE NEW.flat_fee_myr * c.fx END,
      CASE WHEN c.code = 'MYR' THEN NEW.volume_fee_per_litre_myr ELSE NEW.volume_fee_per_litre_myr * c.fx END,
      CASE WHEN c.code = 'MYR' THEN NEW.per_item_fee_myr ELSE NEW.per_item_fee_myr * c.fx END,
      now(),
      auth.uid()
    )
    ON CONFLICT (shipping_rate_id, currency_code)
    DO UPDATE SET
      base_fee = EXCLUDED.base_fee,
      additional_fee = EXCLUDED.additional_fee,
      flat_fee = EXCLUDED.flat_fee,
      volume_fee_per_litre = EXCLUDED.volume_fee_per_litre,
      per_item_fee = EXCLUDED.per_item_fee,
      updated_at = now(),
      updated_by = auth.uid();
  END LOOP;

  RETURN NEW;
END;
$function$;
