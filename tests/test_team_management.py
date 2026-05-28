from fastapi.testclient import TestClient

from src.app import app, reset_data


client = TestClient(app)


def setup_function():
    reset_data()


def test_member_role_is_view_only_for_mutations():
    response = client.post(
        "/teams?actor_role=member&actor_email=member@company.com",
        json={
            "name": "Analytics",
            "description": "BI",
            "manager_email": "member@company.com",
            "team_email": "analytics@company.com",
            "team_contact": "+1-555-0199",
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Only managers can perform this action"


def test_manager_can_create_update_and_delete_team_and_member():
    create_team_response = client.post(
        "/teams?actor_role=manager&actor_email=manager@company.com",
        json={
            "name": "Data Team",
            "description": "Handles reporting",
            "manager_email": "manager@company.com",
            "team_email": "data@company.com",
            "team_contact": "+1-555-0222",
        },
    )
    assert create_team_response.status_code == 201
    team = create_team_response.json()

    update_team_response = client.put(
        f"/teams/{team['id']}?actor_role=manager&actor_email=manager@company.com",
        json={
            "name": "Data Engineering",
            "description": "Handles data systems",
            "team_email": "data-eng@company.com",
            "team_contact": "+1-555-0333",
        },
    )
    assert update_team_response.status_code == 200
    assert update_team_response.json()["name"] == "Data Engineering"

    add_member_response = client.post(
        f"/teams/{team['id']}/members?actor_role=manager&actor_email=manager@company.com",
        json={
            "name": "Noah",
            "title": "Engineer",
            "skills": ["SQL", "Python"],
            "personal_email": "noah.personal@example.com",
            "personal_contact": "+1-555-0444",
        },
    )
    assert add_member_response.status_code == 201
    member = add_member_response.json()

    update_member_response = client.put(
        f"/teams/{team['id']}/members/{member['id']}?actor_role=manager&actor_email=manager@company.com",
        json={
            "name": "Noah M",
            "title": "Senior Engineer",
            "skills": ["SQL", "Python", "Airflow"],
            "personal_email": "noah.personal@example.com",
            "personal_contact": "+1-555-0555",
        },
    )
    assert update_member_response.status_code == 200
    assert update_member_response.json()["title"] == "Senior Engineer"

    delete_member_response = client.delete(
        f"/teams/{team['id']}/members/{member['id']}?actor_role=manager&actor_email=manager@company.com"
    )
    assert delete_member_response.status_code == 200

    delete_team_response = client.delete(
        f"/teams/{team['id']}?actor_role=manager&actor_email=manager@company.com"
    )
    assert delete_team_response.status_code == 200


def test_dashboard_returns_only_managers_teams():
    client.post(
        "/teams?actor_role=manager&actor_email=manager@company.com",
        json={
            "name": "Security Team",
            "description": "Security ownership",
            "manager_email": "manager@company.com",
            "team_email": "security@company.com",
            "team_contact": "+1-555-0777",
        },
    )

    dashboard_response = client.get("/managers/manager@company.com/dashboard")
    assert dashboard_response.status_code == 200
    payload = dashboard_response.json()
    assert payload["manager_email"] == "manager@company.com"
    assert payload["team_count"] >= 1
    assert all(team["manager_email"] == "manager@company.com" for team in payload["teams"])
