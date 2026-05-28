"""
Team management API.
"""

import copy
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI(
    title="Team Management API",
    description="Manage teams, members, and manager dashboards",
)

app.mount(
    "/static",
    StaticFiles(directory=os.path.join(Path(__file__).parent, "static")),
    name="static",
)

INITIAL_TEAMS = {
    "team-1": {
        "id": "team-1",
        "name": "Platform Engineering",
        "description": "Build and maintain shared platform services",
        "manager_email": "manager@company.com",
        "team_email": "platform@company.com",
        "team_contact": "+1-555-0100",
        "members": {
            "member-1": {
                "id": "member-1",
                "name": "Ava Patel",
                "title": "Senior Engineer",
                "skills": ["Python", "FastAPI", "PostgreSQL"],
                "personal_email": "ava.personal@example.com",
                "personal_contact": "+1-555-1111",
            }
        },
    }
}

teams = {}
team_counter = 1
member_counter = 1


def reset_data() -> None:
    global teams, team_counter, member_counter
    teams = copy.deepcopy(INITIAL_TEAMS)
    team_counter = 1
    member_counter = 1


def require_manager(actor_role: str, actor_email: str, team: dict | None = None) -> None:
    if actor_role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can perform this action")
    if team and actor_email != team["manager_email"]:
        raise HTTPException(status_code=403, detail="Manager can only manage their own team")


def next_team_id() -> str:
    global team_counter
    team_counter += 1
    return f"team-{team_counter}"


def next_member_id() -> str:
    global member_counter
    member_counter += 1
    return f"member-{member_counter}"


def get_team_or_404(team_id: str) -> dict:
    team = teams.get(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


class TeamCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    manager_email: str = Field(min_length=1)
    team_email: str = Field(min_length=1)
    team_contact: str = ""


class TeamUpdate(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    team_email: str = Field(min_length=1)
    team_contact: str = ""


class MemberCreate(BaseModel):
    name: str = Field(min_length=1)
    title: str = ""
    skills: list[str] = Field(default_factory=list)
    personal_email: str = Field(min_length=1)
    personal_contact: str = ""


class MemberUpdate(BaseModel):
    name: str = Field(min_length=1)
    title: str = ""
    skills: list[str] = Field(default_factory=list)
    personal_email: str = Field(min_length=1)
    personal_contact: str = ""


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/teams")
def list_teams():
    return list(teams.values())


@app.get("/teams/{team_id}")
def get_team(team_id: str):
    return get_team_or_404(team_id)


@app.get("/managers/{manager_email}/dashboard")
def get_manager_dashboard(manager_email: str):
    managed_teams = [team for team in teams.values() if team["manager_email"] == manager_email]
    return {"manager_email": manager_email, "team_count": len(managed_teams), "teams": managed_teams}


@app.post("/teams", status_code=201)
def create_team(payload: TeamCreate, actor_role: str = Query(...), actor_email: str = Query(...)):
    require_manager(actor_role, actor_email)
    if actor_email != payload.manager_email:
        raise HTTPException(status_code=403, detail="Managers can only create teams for themselves")

    team_id = next_team_id()
    team = {
        "id": team_id,
        "name": payload.name,
        "description": payload.description,
        "manager_email": payload.manager_email,
        "team_email": payload.team_email,
        "team_contact": payload.team_contact,
        "members": {},
    }
    teams[team_id] = team
    return team


@app.put("/teams/{team_id}")
def update_team(
    team_id: str,
    payload: TeamUpdate,
    actor_role: str = Query(...),
    actor_email: str = Query(...),
):
    team = get_team_or_404(team_id)
    require_manager(actor_role, actor_email, team)
    team.update(
        {
            "name": payload.name,
            "description": payload.description,
            "team_email": payload.team_email,
            "team_contact": payload.team_contact,
        }
    )
    return team


@app.delete("/teams/{team_id}")
def delete_team(team_id: str, actor_role: str = Query(...), actor_email: str = Query(...)):
    team = get_team_or_404(team_id)
    require_manager(actor_role, actor_email, team)
    del teams[team_id]
    return {"message": "Team deleted"}


@app.post("/teams/{team_id}/members", status_code=201)
def add_member(
    team_id: str,
    payload: MemberCreate,
    actor_role: str = Query(...),
    actor_email: str = Query(...),
):
    team = get_team_or_404(team_id)
    require_manager(actor_role, actor_email, team)
    member_id = next_member_id()
    member = {
        "id": member_id,
        "name": payload.name,
        "title": payload.title,
        "skills": payload.skills,
        "personal_email": payload.personal_email,
        "personal_contact": payload.personal_contact,
    }
    team["members"][member_id] = member
    return member


@app.get("/teams/{team_id}/members/{member_id}")
def get_member(team_id: str, member_id: str):
    team = get_team_or_404(team_id)
    member = team["members"].get(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@app.put("/teams/{team_id}/members/{member_id}")
def update_member(
    team_id: str,
    member_id: str,
    payload: MemberUpdate,
    actor_role: str = Query(...),
    actor_email: str = Query(...),
):
    team = get_team_or_404(team_id)
    require_manager(actor_role, actor_email, team)
    member = team["members"].get(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.update(
        {
            "name": payload.name,
            "title": payload.title,
            "skills": payload.skills,
            "personal_email": payload.personal_email,
            "personal_contact": payload.personal_contact,
        }
    )
    return member


@app.delete("/teams/{team_id}/members/{member_id}")
def delete_member(
    team_id: str,
    member_id: str,
    actor_role: str = Query(...),
    actor_email: str = Query(...),
):
    team = get_team_or_404(team_id)
    require_manager(actor_role, actor_email, team)
    member = team["members"].get(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    del team["members"][member_id]
    return {"message": "Member deleted"}


reset_data()
