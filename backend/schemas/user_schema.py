from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _empty_to_none(value):
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return value


def _parse_date_or_none(value):
    val = _empty_to_none(value)
    if val is None:
        return None
    if isinstance(val, str):
        v = val.strip()
        if not v:
            return None
        parts = v.replace("-", "/").split("/")
        if len(parts) == 3 and len(parts[0]) <= 2 and len(parts[2]) == 4:
            try:
                d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                return date(y, m, d)
            except Exception:
                pass
        return v
    return val


class UserDetails(BaseModel):
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=30)

    model_config = ConfigDict(extra="forbid")

    @field_validator("first_name", "last_name", "email", "phone", mode="before")
    @classmethod
    def blank_to_none(cls, value):
        return _empty_to_none(value)


class UserCreate(UserDetails):
    password: str | None = None

    @field_validator("password", mode="before")
    @classmethod
    def blank_password_to_none(cls, value):
        return _empty_to_none(value)


class EmployeeCreate(UserDetails):
    joining_date: date | None = None

    @field_validator("joining_date", mode="before")
    @classmethod
    def blank_date_to_none(cls, value):
        return _parse_date_or_none(value)


class UserDetailsUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=30)

    model_config = ConfigDict(extra="forbid")

    @field_validator("first_name", "last_name", "email", "phone", mode="before")
    @classmethod
    def blank_to_none(cls, value):
        return _empty_to_none(value)


class SupervisorUpdate(UserDetailsUpdate):
    password: str | None = None

    @field_validator("password", mode="before")
    @classmethod
    def blank_password_to_none(cls, value):
        return _empty_to_none(value)


class EmployeeUpdate(UserDetailsUpdate):
    joining_date: date | None = None

    @field_validator("joining_date", mode="before")
    @classmethod
    def blank_date_to_none(cls, value):
        return _parse_date_or_none(value)


class UserRead(BaseModel):
    id: int
    code: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    role: str
    joining_date: date | None = None

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)
