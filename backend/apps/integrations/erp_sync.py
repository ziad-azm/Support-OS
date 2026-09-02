"""Field mapping and upsert logic — INT-2 (Story 81).

Deliberately HTTP-independent: every function here takes already-decoded
records, so the mapping rules can be exercised from a shell against a
literal dict with no ERP and no network — the same "plain, HTTP-free
function" reasoning `apps/knowledge_base/search.py` (KB-3) records for
itself. `erp_client` does the talking; this module does the deciding.
"""

import logging

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.customers.models import Customer

from .erp_client import ErpError, fetch_customers, fetch_orders, push_customer
from .models import ErpOrder, ErpSyncRun

logger = logging.getLogger(__name__)

# The safety boundary a field map may not cross. `external_id` is absent
# on purpose — it is the correlation key the upsert matches on, set from
# `ErpConnection.customer_external_id_field`, never a mappable target.
# `user` is absent too: the portal-login link is a staff-only decision
# (`apps/customers/models.py:38-45`, Story 42), and a bulk import must
# never be able to re-point it.
CUSTOMER_SYNCABLE_FIELDS = frozenset({"name", "email", "phone", "company"})
ORDER_SYNCABLE_FIELDS = frozenset(
    {"order_number", "status", "total_amount", "currency", "placed_at"}
)

# Order fields that must be coerced out of the JSON string the ERP sends.
_ORDER_DATETIME_FIELDS = frozenset({"placed_at"})


def apply_field_map(record: dict, field_map: dict[str, str], allowed: frozenset[str]) -> dict:
    """Translate one ERP record into SupportOS field names.

    Skips a mapped source key the record does not carry (a partial ERP
    payload is normal), and re-checks `allowed` even though
    `ErpConnection.clean()`/the serializer already did — a map written
    directly through the ORM or a shell bypasses both, and this is the
    layer that actually assigns to a model.
    """
    mapped: dict = {}
    for source, target in field_map.items():
        if target not in allowed or source not in record:
            continue
        mapped[target] = record[source]
    return mapped


def _coerce_datetimes(values: dict, fields: frozenset[str]) -> dict:
    for field in fields:
        raw = values.get(field)
        if isinstance(raw, str):
            parsed = parse_datetime(raw)
            # An unparseable timestamp drops the field rather than failing
            # the whole record — the rest of the order is still useful.
            if parsed is None:
                values.pop(field)
            else:
                values[field] = parsed
    return values


def import_customers(connection, run: ErpSyncRun) -> None:
    """Upsert every ERP customer onto `customers.Customer`, matched by
    `external_id`. A record with no id is counted as skipped, not failed:
    it is the ERP's omission, not an error on this side.
    """
    id_field = connection.customer_external_id_field
    for record in fetch_customers(connection):
        external_id = record.get(id_field)
        if external_id in (None, ""):
            run.skipped_count += 1
            continue
        values = apply_field_map(record, connection.customer_field_map, CUSTOMER_SYNCABLE_FIELDS)
        # Blank email must become NULL before it reaches a unique column
        # — `Customer.clean()`'s own rule (apps/customers/models.py:57-66),
        # which `update_or_create` does not run.
        if "email" in values and not values["email"]:
            values["email"] = None
        if not values:
            run.skipped_count += 1
            continue
        try:
            _customer, created = Customer.objects.update_or_create(
                external_id=str(external_id), defaults=values
            )
        except Exception:
            # One bad record (a duplicate email, an over-long name) must
            # not abort the run — a partial sync is the normal outcome of
            # imperfect upstream data. Logged without the payload (§ 10).
            logger.exception("ERP customer %s failed to import", external_id)
            run.failed_count += 1
            continue
        if created:
            run.created_count += 1
        else:
            run.updated_count += 1


def import_orders(connection, run: ErpSyncRun) -> None:
    """Upsert every ERP order onto `ErpOrder`, matched by `external_id`
    and linked to the `Customer` whose `external_id` the order references.

    An order whose customer has not been imported yet is **skipped, not
    failed** — on a first run the customer pass may simply not have
    reached it, and the next run picks it up. `import_customers` runs
    first for exactly this reason (`tasks.run_erp_sync`).
    """
    id_field = connection.order_external_id_field
    ref_field = connection.order_customer_ref_field
    for record in fetch_orders(connection):
        external_id = record.get(id_field)
        customer_ref = record.get(ref_field)
        if external_id in (None, "") or customer_ref in (None, ""):
            run.skipped_count += 1
            continue
        customer = Customer.objects.filter(external_id=str(customer_ref)).first()
        if customer is None:
            run.skipped_count += 1
            continue
        values = _coerce_datetimes(
            apply_field_map(record, connection.order_field_map, ORDER_SYNCABLE_FIELDS),
            _ORDER_DATETIME_FIELDS,
        )
        values["customer"] = customer
        values["raw"] = record
        values["synced_at"] = timezone.now()
        try:
            _order, created = ErpOrder.objects.update_or_create(
                external_id=str(external_id), defaults=values
            )
        except Exception:
            logger.exception("ERP order %s failed to import", external_id)
            run.failed_count += 1
            continue
        if created:
            run.created_count += 1
        else:
            run.updated_count += 1


def export_customers(connection, run: ErpSyncRun) -> None:
    """Push every SupportOS-originated customer (no `external_id` yet) to
    the ERP and store the id it returns.

    Inverts `customer_field_map` to build the outbound payload, so one
    configured mapping serves both directions. A duplicate ERP target key
    would make the inversion lossy; `ErpConnection.clean()` does not
    forbid that (the map is legitimately many-to-one on import), so the
    last one wins here and `## Edge Cases` says so.
    """
    id_field = connection.customer_external_id_field
    outbound = {target: source for source, target in connection.customer_field_map.items()}
    pending = Customer.objects.filter(external_id__isnull=True)
    for customer in pending.iterator():
        payload = {
            erp_field: getattr(customer, local_field)
            for local_field, erp_field in outbound.items()
            if getattr(customer, local_field, None) not in (None, "")
        }
        if not payload:
            run.skipped_count += 1
            continue
        try:
            response = push_customer(connection, payload)
        except ErpError:
            logger.exception("ERP export failed for customer %s", customer.pk)
            run.failed_count += 1
            continue
        new_id = response.get(id_field)
        if new_id in (None, ""):
            # The ERP accepted the record but told us nothing we can
            # correlate on. Counted as failed, not created: without an id
            # the next run would push a duplicate.
            logger.warning("ERP accepted customer %s but returned no '%s'", customer.pk, id_field)
            run.failed_count += 1
            continue
        customer.external_id = str(new_id)
        try:
            customer.save(update_fields=["external_id", "updated_at"])
        except Exception:
            # The ERP already accepted the push — this is a purely local
            # failure (e.g. two records colliding on the same returned
            # id) and must not abort the run any more than a bad
            # `import_customers`/`import_orders` record does. The next
            # run will push this customer again, since its `external_id`
            # was never actually persisted here.
            logger.exception("Failed to store external_id %s for customer %s", new_id, customer.pk)
            run.failed_count += 1
            continue
        run.created_count += 1
