from contextlib import asynccontextmanager

from fastapi import FastAPI

from db.database import initialize_database
from routes.customer import router as customer_router
from routes.daily_input import router as daily_input_router
from routes.element import router as element_router
from routes.raw_material import router as raw_material_router
from routes.supplier import router as supplier_router
from routes.user import router as user_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="My Backend API", version="1.0.0", lifespan=lifespan)

app.include_router(user_router)
app.include_router(raw_material_router)
app.include_router(element_router)
app.include_router(supplier_router)
app.include_router(customer_router)
app.include_router(daily_input_router)


@app.get("/")
async def root():
    return {"message": "Backend is running"}
