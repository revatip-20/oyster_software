from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from models.user import User
from schemas.user_schema import (
    EmployeeCreate,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    EmployeeUpdate,
    SupervisorUpdate,
    UserCreate,
    UserDetails,
    UserRead,
)
from security import (
    ACCESS_TOKEN_MINUTES,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from services.code_generator import get_next_resource_code

router = APIRouter(prefix="/users", tags=["users"])
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    try:
        payload = decode_token(credentials.credentials, "access")
        user_id = int(payload["sub"])
    except (JWTError, KeyError, TypeError, ValueError):
        raise unauthorized

    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if user is None or user.role == "employee":
        raise unauthorized
    return user


def require_roles(*allowed_roles: str):
    def check_role(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return check_role


def create_user(
    user: UserDetails,
    role: str,
    db: Session,
    password: str | None = None,
    joining_date: date | None = None,
) -> User:
    email = user.email.strip() if (user.email and str(user.email).strip()) else None
    if email:
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    code = None
    if role == "employee":
        code = get_next_resource_code(db, User, User.code, "EMP")

    new_user = User(
        code=code,
        first_name=user.first_name,
        last_name=user.last_name,
        email=email,
        phone=user.phone,
        password_hash=hash_password(password) if (password and str(password).strip()) else None,
        role=role,
        joining_date=joining_date,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=LoginResponse)
def login(
    credentials: LoginRequest,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == credentials.email, User.deleted_at.is_(None)).first()
    if (
        user is None
        or user.role == "employee"
        or not verify_password(credentials.password, user.password_hash or "")
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return LoginResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=ACCESS_TOKEN_MINUTES * 60,
        user=UserRead.model_validate(user),
    )


@router.post("/refresh", response_model=LoginResponse)
def refresh_access_token(
    request: RefreshRequest,
    db: Session = Depends(get_db),
):
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(request.refresh_token, "refresh")
        user_id = int(payload["sub"])
    except (JWTError, KeyError, TypeError, ValueError):
        raise unauthorized

    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if user is None or user.role == "employee":
        raise unauthorized

    return LoginResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=ACCESS_TOKEN_MINUTES * 60,
        user=UserRead.model_validate(user),
    )


@router.get(
    "/get-supervisor",
    response_model=list[UserRead],
    dependencies=[Depends(require_roles("admin"))],
)
def get_supervisors(db: Session = Depends(get_db)):
    return (
        db.query(User)
        .filter(User.role == "supervisor", User.deleted_at.is_(None))
        .order_by(User.id)
        .all()
    )


@router.get(
    "/get-employess",
    response_model=list[UserRead],
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
@router.get(
    "/get-employees",
    response_model=list[UserRead],
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def get_employees(db: Session = Depends(get_db)):
    return (
        db.query(User)
        .filter(User.role == "employee", User.deleted_at.is_(None))
        .order_by(User.id)
        .all()
    )


@router.post(
    "/add-supervisor",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin"))],
)
def add_supervisor(
    user: UserCreate,
    db: Session = Depends(get_db),
):
    return create_user(user, "supervisor", db, password=user.password)


@router.post(
    "/add-employee",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def add_employee(
    user: EmployeeCreate,
    db: Session = Depends(get_db),
):
    return create_user(user, "employee", db, joining_date=user.joining_date)


@router.patch(
    "/edit-supervisor/{user_id}",
    response_model=UserRead,
    dependencies=[Depends(require_roles("admin"))],
)
def edit_supervisor(user_id: int, update: SupervisorUpdate, db: Session = Depends(get_db)):
    supervisor = db.query(User).filter(
        User.id == user_id,
        User.role == "supervisor",
        User.deleted_at.is_(None),
    ).first()
    if supervisor is None:
        raise HTTPException(status_code=404, detail="Supervisor not found")

    changes = update.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="At least one field must be provided")
    password = changes.pop("password", None)
    if "email" in changes:
        email = changes["email"].strip() if (changes["email"] and str(changes["email"]).strip()) else None
        changes["email"] = email
        if email and db.query(User.id).filter(
            User.email == email,
            User.id != user_id,
        ).first():
            raise HTTPException(status_code=409, detail="Email is already registered")

    for field, value in changes.items():
        setattr(supervisor, field, value)
    if password:
        supervisor.password_hash = hash_password(password)
    supervisor.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email is already registered") from error
    db.refresh(supervisor)
    return supervisor


@router.delete(
    "/delete-supervisor/{user_id}",
    response_model=UserRead,
    dependencies=[Depends(require_roles("admin"))],
)
def delete_supervisor(user_id: int, db: Session = Depends(get_db)):
    supervisor = db.query(User).filter(
        User.id == user_id,
        User.role == "supervisor",
        User.deleted_at.is_(None),
    ).first()
    if supervisor is None:
        raise HTTPException(status_code=404, detail="Supervisor not found")

    now = datetime.now(timezone.utc)
    supervisor.deleted_at = now
    supervisor.updated_at = now
    db.commit()
    db.refresh(supervisor)
    return supervisor


@router.patch(
    "/edit-employee/{user_id}",
    response_model=UserRead,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def edit_employee(user_id: int, update: EmployeeUpdate, db: Session = Depends(get_db)):
    employee = db.query(User).filter(
        User.id == user_id,
        User.role == "employee",
        User.deleted_at.is_(None),
    ).first()
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    changes = update.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="At least one field must be provided")
    if "email" in changes:
        email = changes["email"].strip() if (changes["email"] and str(changes["email"]).strip()) else None
        changes["email"] = email
        if email and db.query(User.id).filter(
            User.email == email,
            User.id != user_id,
        ).first():
            raise HTTPException(status_code=409, detail="Email is already registered")

    for field, value in changes.items():
        setattr(employee, field, value)
    employee.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email is already registered") from error
    db.refresh(employee)
    return employee


@router.delete(
    "/delete-employee/{user_id}",
    response_model=UserRead,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def delete_employee(user_id: int, db: Session = Depends(get_db)):
    employee = db.query(User).filter(
        User.id == user_id,
        User.role == "employee",
        User.deleted_at.is_(None),
    ).first()
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    now = datetime.now(timezone.utc)
    employee.deleted_at = now
    employee.updated_at = now
    db.commit()
    db.refresh(employee)
    return employee
