from dotenv import load_dotenv
load_dotenv()  # must run before anything reads os.getenv, so this stays at the top

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.analyze import router as analyze_router

app = FastAPI(
    title="FUME Client Intelligence API",
    description="Analyzes a client-coach conversation transcript into structured, "
                "evidence-grounded client intelligence.",
    version="0.1.0",
)

# Dev-friendly CORS — tighten allow_origins before any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
