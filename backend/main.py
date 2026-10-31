from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.database import initialize_database
from routes.cost_data import router as cost_data_router
from routes.customer import router as customer_router
from routes.consumption import router as consumption_router
from routes.daily_dispatch import router as daily_dispatch_router
from routes.daily_input import router as daily_input_router
from routes.product import router as product_router
from routes.raw_material import router as raw_material_router
from routes.supplier import router as supplier_router
from routes.user import router as user_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="My Backend API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(raw_material_router)
app.include_router(product_router)
app.include_router(cost_data_router)
app.include_router(supplier_router)
app.include_router(customer_router)
app.include_router(daily_input_router)
app.include_router(consumption_router)
app.include_router(daily_dispatch_router)


@app.get("/")
async def root():
    return {"message": "Backend is running"}
