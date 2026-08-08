# models.py

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, timezone
from sqlmodel import SQLModel, Field, Column, JSON

def wita_now():
    """Return current time in WITA (UTC+8)"""
    return datetime.now(timezone(timedelta(hours=8)))

class Issue(SQLModel, table=True):
    # Primary key INTEGER autoincrement
    id: Optional[int] = Field(default=None, primary_key=True)

    title: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = Field(default=None)

    image_url: Optional[str] = Field(default=None, max_length=255)

    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    kecamatan: Optional[str] = Field(default=None, max_length=100)
    kabupaten: Optional[str] = Field(default=None, max_length=100)

    issue_class: Optional[str] = Field(default=None, max_length=50)
    final_score: Optional[int] = Field(default=None)
    severity_label: Optional[str] = Field(default=None, max_length=10)

    breakdown_score: Optional[Dict[str, int]] = Field(
        default=None, sa_column=Column(JSON)
    )

    secondary_issues: Optional[List[Dict[str, Any]]] = Field(
        default=None, sa_column=Column(JSON)
    )

    meta_data: Optional[Dict[str, Any]] = Field(
        default=None, sa_column=Column(JSON)
    )

    timeline: Optional[List[Dict[str, Any]]] = Field(
        default=None, sa_column=Column(JSON)
    )

    status: str = Field(default="PENDING", max_length=20)

    created_at: datetime = Field(default_factory=wita_now)
    updated_at: Optional[datetime] = Field(default=None)
