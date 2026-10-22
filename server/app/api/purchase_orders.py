from flask import Blueprint, jsonify, request
from app.models import db, Supplier, Product, PurchaseOrder, PurchaseOrderLineItem
from models import db, PurchaseOrder, PurchaseOrderLineItem, Product, StockMovement

purchase_orders_bp = Blueprint('purchase_orders', __name__, url_prefix='/api/purchase-orders')

@purchase_orders_bp.route('', methods=['POST'])
def create_purchase_order():
    data = request.get_json()
    supplier_id = data.get('supplier_id')
    items = data.get('items', []) # List of {product_id, quantity_ordered}
    
    # Validate supplier and products exist
    supplier = Supplier.query.get(supplier_id)
    if not supplier:
        return jsonify({"error": "Invalid supplier reference"}), 400
        
    po = PurchaseOrder(supplier_id=supplier_id, status='draft')
    db.session.add(po)
    db.session.flush() # Get po.id
    
    for item_data in items:
        product = Product.query.get(item_data['product_id'])
        if not product:
            db.session.rollback()
            return jsonify({"error": f"Invalid product reference: {item_data['product_id']}"}), 400
            
        po_item = PurchaseOrderLineItem(
            purchase_order_id=po.id,
            product_id=product.id,
            quantity_ordered=item_data['quantity_ordered'],
            quantity_received=0
        )
        db.session.add(po_item)
        
    db.session.commit()
    return jsonify(po.to_dict()), 201

@purchase_orders_bp.route('/<int:po_id>/receive', methods=['POST'])
def receive_purchase_order(po_id):
    data = request.get_json()
    received_items = data.get('items', []) # List of {line_item_id, quantity_received}

    po = PurchaseOrder.query.get(po_id)
    if not po:
        return jsonify({"error": "Purchase order not found"}), 404

    # Prevent duplicate submissions if already fully received or closed
    if po.status == 'received':
        return jsonify({"error": "This purchase order has already been fully received."}), 400

    try:
        all_fully_received = True

        for rec in received_items:
            line_item_id = rec.get('line_item_id')
            qty_incoming = rec.get('quantity_received', 0)

            # Find specific line item
            line_item = PurchaseOrderLineItem.query.get(line_item_id)
            if not line_item or line_item.purchase_order_id != po.id:
                db.session.rollback()
                return jsonify({"error": f"Invalid line item reference: {line_item_id}"}), 400

            # Prevent receiving more than what was ordered
            remaining_to_receive = line_item.quantity_ordered - line_item.quantity_received
            if qty_incoming > remaining_to_receive:
                db.session.rollback()
                return jsonify({"error": f'Cannot receive more than remaining ordered quantity for item {line_item.product_id}'}), 400

            if qty_incoming > 0:
                # Update line item received count
                line_item.quantity_received += qty_incoming

                # Increase actual product stock level
                product = Product.query.get(line_item.product_id)
                product.stock_level += qty_incoming

                # Record stock movement audit trail
                movement = StockMovement(
                    product_id=product.id,
                    quantity=qty_incoming,
                    movement_type='purchase_order_receive',
                    reference_id=po.id
                )
                db.session.add(movement)

            if line_item.quantity_received < line_item.quantity_ordered:
                all_fully_received = False

        # Update overall Purchase Order status
        if all_fully_received:
            po.status = 'received'
        else:
            po.status = 'partially_received'

        db.session.commit()
        return jsonify(po.to_dict()), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500