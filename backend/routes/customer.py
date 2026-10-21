from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.database import get_db
from models.customer import Customer
from routes.user import require_roles
from schemas.customer_schema import CustomerCreate, CustomerRead, CustomerUpdate
from services.code_generator import get_next_resource_code
from sqlalchemy import select

router = APIRouter(tags=["customers"])


@router.get(
    "/get-customers",
    response_model=list[CustomerRead],
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def get_customers(db: Session = Depends(get_db)):
    return db.scalars(
        select(Customer)
        .where(Customer.deleted_at.is_(None))
        .order_by(Customer.id)
    ).all()


@router.post(
    "/customers/",
    response_model=CustomerRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def add_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    data = customer.model_dump()
    code = get_next_resource_code(db, Customer, Customer.code, "CUST")
    new_customer = Customer(code=code, **data)
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer


@router.patch(
    "/customers/{customer_id}",
    response_model=CustomerRead,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def edit_customer(customer_id: int, update: CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.deleted_at.is_(None),
    ).first()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    changes = update.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="At least one field must be provided")

    for field, value in changes.items():
        setattr(customer, field, value)
    customer.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(customer)
    return customer


@router.delete(
    "/customers/{customer_id}",
    response_model=CustomerRead,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.deleted_at.is_(None),
    ).first()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    now = datetime.now(timezone.utc)
    customer.deleted_at = now
    customer.updated_at = now
    db.commit()
    db.refresh(customer)
    return customer