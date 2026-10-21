from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from uuid import UUID

from sqlalchemy import select

from app.extensions import db
from app.models import (
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    Sale,
    SaleItem,
    StockMovement,
    User,
)

MONEY_QUANTUM = Decimal("0.01")


@contextmanager
def _atomic_operation():
    session = db.session()
    if session.in_transaction():
        with session.begin_nested():
            yield
    else:
        with session.begin():
            yield


class InventoryOperationError(ValueError):
    """An inventory operation violates a business rule."""


class DuplicateSaleSubmission(InventoryOperationError):
    """The sale's idempotency key has already been used."""


def _money(value, field):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as error:
        raise InventoryOperationError(f"{field} must be a valid amount") from error
    if not amount.is_finite() or amount < 0:
        raise InventoryOperationError(f"{field} must be non-negative")
    try:
        return amount.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    except InvalidOperation as error:
        raise InventoryOperationError(f"{field} is outside the supported range") from error


def _tax_rate(value):
    try:
        rate = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as error:
        raise InventoryOperationError("tax_rate must be a valid rate") from error
    if not rate.is_finite() or rate < 0 or rate > 1:
        raise InventoryOperationError("tax_rate must be between 0 and 1")
    return rate


def create_sale(
    *,
    sale_number,
    user_id,
    items,
    discount_amount=Decimal("0.00"),
    tax_rate=Decimal("0.00"),
    idempotency_key=None,
):
    """Create a sale and its stock movements as one transaction."""
    if not isinstance(sale_number, str) or not sale_number.strip():
        raise InventoryOperationError("sale_number is required")
    if isinstance(user_id, bool) or not isinstance(user_id, int) or user_id <= 0:
        raise InventoryOperationError("user_id must be a positive integer")
    if not isinstance(items, (list, tuple)) or not items:
        raise InventoryOperationError("items must contain at least one product")
    if idempotency_key is not None and not isinstance(idempotency_key, UUID):
        raise InventoryOperationError("idempotency_key must be a UUID")

    quantities = defaultdict(int)
    for item in items:
        if not isinstance(item, (list, tuple)) or len(item) != 2:
            raise InventoryOperationError(
                "each item must contain a product_id and quantity"
            )
        product_id, quantity = item
        if (
            isinstance(product_id, bool)
            or not isinstance(product_id, int)
            or product_id <= 0
        ):
            raise InventoryOperationError("product_id must be a positive integer")
        if (
            isinstance(quantity, bool)
            or not isinstance(quantity, int)
            or quantity <= 0
        ):
            raise InventoryOperationError("quantity must be a positive integer")
        quantities[product_id] += quantity

    discount = _money(discount_amount, "discount_amount")
    rate = _tax_rate(tax_rate)

    with _atomic_operation():
        if idempotency_key is not None:
            existing = db.session.scalar(
                select(Sale.id).where(Sale.idempotency_key == idempotency_key)
            )
            if existing is not None:
                raise DuplicateSaleSubmission(
                    f"idempotency_key has already been used for sale {existing}"
                )

        user = db.session.get(User, user_id)
        if user is None or not user.is_active:
            raise InventoryOperationError("active user was not found")

        products = db.session.scalars(
            select(Product)
            .where(Product.id.in_(sorted(quantities)))
            .order_by(Product.id)
            .with_for_update()
        ).all()
        if len(products) != len(quantities):
            raise InventoryOperationError("one or more products were not found")

        subtotal = Decimal("0.00")
        for product in products:
            quantity = quantities[product.id]
            if not product.is_active:
                raise InventoryOperationError(f"product {product.id} is inactive")
            if product.quantity < quantity:
                raise InventoryOperationError(
                    f"insufficient stock for product {product.id}"
                )
            subtotal += product.selling_price * quantity

        subtotal = subtotal.quantize(MONEY_QUANTUM)
        if discount > subtotal:
            raise InventoryOperationError("discount_amount cannot exceed subtotal")
        tax_amount = ((subtotal - discount) * rate).quantize(
            MONEY_QUANTUM, rounding=ROUND_HALF_UP
        )
        sale = Sale(
            sale_number=sale_number.strip(),
            user_id=user_id,
            status="completed",
            subtotal=subtotal,
            discount_amount=discount,
            tax_amount=tax_amount,
            total_amount=subtotal - discount + tax_amount,
            idempotency_key=idempotency_key,
        )
        db.session.add(sale)
        db.session.flush()

        for product in products:
            quantity = quantities[product.id]
            product.quantity -= quantity
            db.session.add(
                SaleItem(
                    sale_id=sale.id,
                    product_id=product.id,
                    quantity=quantity,
                    unit_price=product.selling_price,
                    unit_cost=product.cost_price,
                    line_total=product.selling_price * quantity,
                )
            )
            db.session.add(
                StockMovement(
                    product_id=product.id,
                    user_id=user_id,
                    movement_type="sale",
                    quantity_change=-quantity,
                    reason=f"Sale {sale.sale_number}",
                    reference_type="sale",
                    reference_id=sale.id,
                )
            )

        return sale


def receive_purchase_order_item(*, item_id, quantity, user_id):
    """Receive stock and update its purchase order in one transaction."""
    if isinstance(item_id, bool) or not isinstance(item_id, int) or item_id <= 0:
        raise InventoryOperationError("item_id must be a positive integer")
    if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity <= 0:
        raise InventoryOperationError("quantity must be a positive integer")
    if isinstance(user_id, bool) or not isinstance(user_id, int) or user_id <= 0:
        raise InventoryOperationError("user_id must be a positive integer")

    with _atomic_operation():
        item = db.session.get(PurchaseOrderItem, item_id)
        if item is None:
            raise InventoryOperationError("purchase order item was not found")

        order = db.session.scalar(
            select(PurchaseOrder)
            .where(PurchaseOrder.id == item.purchase_order_id)
            .with_for_update()
        )
        if order is None or order.status not in {"ordered", "partial"}:
            raise InventoryOperationError(
                "purchase order must be ordered or partially received"
            )

        item = db.session.scalar(
            select(PurchaseOrderItem)
            .where(PurchaseOrderItem.id == item_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if item.quantity_received + quantity > item.quantity_ordered:
            raise InventoryOperationError("received quantity cannot exceed ordered")

        user = db.session.get(User, user_id)
        if user is None or not user.is_active:
            raise InventoryOperationError("active user was not found")
        product = db.session.scalar(
            select(Product)
            .where(Product.id == item.product_id)
            .with_for_update()
        )
        if product is None:
            raise InventoryOperationError("purchase order product was not found")

        item.quantity_received += quantity
        product.quantity += quantity
        db.session.add(
            StockMovement(
                product_id=product.id,
                user_id=user_id,
                movement_type="receipt",
                quantity_change=quantity,
                reason=f"Received purchase order {order.purchase_number}",
                reference_type="purchase_order",
                reference_id=order.id,
            )
        )
        db.session.flush()

        outstanding = db.session.scalar(
            select(PurchaseOrderItem.id)
            .where(
                PurchaseOrderItem.purchase_order_id == order.id,
                PurchaseOrderItem.quantity_received
                < PurchaseOrderItem.quantity_ordered,
            )
            .limit(1)
        )
        if outstanding is None:
            order.status = "received"
            order.received_at = datetime.now(timezone.utc)
        else:
            order.status = "partial"

        return order
