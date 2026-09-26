"""Production entry point: one service serving the built frontend, the API under /api and the live socket at /ws.

Run: uvicorn app.serve:app --host 0.0.0.0 --port $PORT   (after `npm --prefix frontend run build`)
"""
import os

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .main import app as api
from .main import ws as ws_endpoint

DIST = os.environ.get("FRONTEND_DIST", os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

app = FastAPI(title="TourCraft", lifespan=api.router.lifespan_context)
app.add_api_websocket_route("/ws", ws_endpoint)
app.mount("/api", api)
if os.path.isdir(os.path.join(DIST, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")), name="assets")


@app.get("/{path:path}", include_in_schema=False)
async def spa(path: str):
    """Serve real files from the build; every other path is a client-side route -> index.html."""
    f = os.path.normpath(os.path.join(DIST, path))
    if path and f.startswith(os.path.normpath(DIST)) and os.path.isfile(f):
        return FileResponse(f)
    return FileResponse(os.path.join(DIST, "index.html"))
