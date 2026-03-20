# app/routes/chat.py
from fastapi import APIRouter, HTTPException
from app.schemas.prediction_schema import ChatRequest, ChatResponse
from app.services.chat_service import process_chat
from app.services import memory_service

router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        return await process_chat(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/history")
async def get_session_history(session_id: str, limit: int = 50):
    history = await memory_service.get_history(session_id, limit=limit)
    return {"session_id": session_id, "messages": history, "count": len(history)}


@router.get("/session/{session_id}/summary")
async def get_session_summary(session_id: str):
    return await memory_service.get_session_summary(session_id)


@router.post("/session/new")
async def create_new_session():
    session_id = await memory_service.create_session()
    return {"session_id": session_id}


@router.get("/sessions")
async def list_sessions(limit: int = 50, include_deleted: bool = False):
    return await memory_service.get_all_sessions(limit, include_deleted=include_deleted)


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Soft-delete a chat session and all its messages."""
    result = await memory_service.soft_delete_session(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted", "session_id": session_id}


@router.post("/session/{session_id}/restore")
async def restore_session(session_id: str):
    """Restore a soft-deleted chat session."""
    result = await memory_service.restore_session(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "restored", "session_id": session_id}