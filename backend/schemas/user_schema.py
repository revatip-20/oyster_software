from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserDetails(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=1, max_length=30)

    model_config = ConfigDict(extra="forbid")


class UserCreate(UserDetails):
    password: str = Field(min_length=8)


class EmployeeCreate(UserDetails):
    joining_date: date


class UserDetailsUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=1, max_length=30)

    model_config = ConfigDict(extra="forbid")


class SupervisorUpdate(UserDetailsUpdate):
    password: str | None = Field(default=None, min_length=8)


class EmployeeUpdate(UserDetailsUpdate):
    joining_date: date | None = None


class UserRead(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
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
