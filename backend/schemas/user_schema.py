from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _empty_to_none(value):
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return value


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
