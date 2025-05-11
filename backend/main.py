from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from uuid import uuid4
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Comment(BaseModel):
    text: str
    timestamp: str

class Ratings(BaseModel):
    cleanliness: List[int] = []
    accessibility: List[int] = []
    crowd: List[int] = []

class Toilet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    lat: float
    lng: float
    address: str
    summary: str
    comments: List[Comment] = []
    ratings: Ratings = Ratings()
    createdAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class ToiletCreate(BaseModel):
    name: str
    lat: float
    lng: float
    address: str
    summary: str
    comments: List[Comment]
    ratings: Dict[str, int]  # expected: {cleanliness: int, accessibility: int, crowd: int}
    createdAt: str

toilets: List[Toilet] = []

@app.get("/toilets")
def get_toilets():
    return toilets

@app.post("/toilets")
def add_toilet(toilet: ToiletCreate):
    initial_ratings = Ratings(
        cleanliness=[toilet.ratings.get("cleanliness", 0)],
        accessibility=[toilet.ratings.get("accessibility", 0)],
        crowd=[toilet.ratings.get("crowd", 0)]
    )
    t = Toilet(
        id=str(uuid4()),
        name=toilet.name,
        lat=toilet.lat,
        lng=toilet.lng,
        address=toilet.address,
        summary=toilet.summary,
        comments=toilet.comments,
        ratings=initial_ratings,
        createdAt=toilet.createdAt
    )
    toilets.append(t)
    return t

@app.post("/toilets/{toilet_id}/comment")
def add_comment(toilet_id: str, payload: Dict):
    for t in toilets:
        if t.id == toilet_id:
            text = payload.get("text", "")
            timestamp = payload.get("timestamp", datetime.utcnow().isoformat())
            ratings = payload.get("ratings", {})
            t.comments.append(Comment(text=text, timestamp=timestamp))

            for dim in ["cleanliness", "accessibility", "crowd"]:
                score = ratings.get(dim)
                if isinstance(score, int) and 1 <= score <= 5:
                    getattr(t.ratings, dim).append(score)
            return {"ok": True}
    raise HTTPException(status_code=404, detail="Toilet not found")