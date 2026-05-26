from datetime import datetime


def auth_header(client, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_admin(client):
    from app.models import User, UserRole
    from app.security import get_password_hash

    with client.app.state.testing_session() as db:
        db.add(User(username="admin", password_hash=get_password_hash("admin123456"), role=UserRole.admin))
        db.commit()


def test_admin_creates_user_and_user_cannot_list_users(client):
    create_admin(client)
    admin_headers = auth_header(client, "admin", "admin123456")

    created = client.post(
        "/api/users",
        json={"username": "alice", "password": "password123", "role": "user"},
        headers=admin_headers,
    )
    assert created.status_code == 201

    user_headers = auth_header(client, "alice", "password123")
    forbidden = client.get("/api/users", headers=user_headers)
    assert forbidden.status_code == 403


def test_user_data_isolation_and_admin_visibility(client):
    create_admin(client)
    admin_headers = auth_header(client, "admin", "admin123456")
    client.post("/api/users", json={"username": "alice", "password": "password123"}, headers=admin_headers)
    client.post("/api/users", json={"username": "bob", "password": "password123"}, headers=admin_headers)
    alice_headers = auth_header(client, "alice", "password123")
    bob_headers = auth_header(client, "bob", "password123")

    payload = {
        "kind": "single",
        "sport": "football",
        "event_name": "A vs B",
        "market": "胜负",
        "selection": "A",
        "odds": "1.900",
        "stake": "100.00",
        "placed_at": datetime.utcnow().isoformat(),
        "status": "won",
        "tag_names": ["主场", "强队"],
    }
    assert client.post("/api/bets", json=payload, headers=alice_headers).status_code == 201
    assert client.get("/api/bets", headers=bob_headers).json() == []
    assert len(client.get("/api/bets", headers=admin_headers).json()) == 1


def test_parlay_requires_legs_and_stats(client):
    create_admin(client)
    admin_headers = auth_header(client, "admin", "admin123456")
    bad = {
        "kind": "parlay",
        "sport": "basketball",
        "event_name": "串关",
        "market": "parlay",
        "selection": "2-leg",
        "odds": "3.000",
        "stake": "50.00",
        "placed_at": datetime.utcnow().isoformat(),
    }
    assert client.post("/api/bets", json=bad, headers=admin_headers).status_code == 422

    good = bad | {
        "status": "lost",
        "legs": [
            {"sport": "basketball", "event_name": "C vs D", "market": "大小", "selection": "大", "odds": "1.8"},
            {"sport": "football", "event_name": "E vs F", "market": "让球", "selection": "E -1", "odds": "1.7"},
        ],
    }
    assert client.post("/api/bets", json=good, headers=admin_headers).status_code == 201
    stats = client.get("/api/stats", headers=admin_headers).json()
    assert stats["bets"] == 1
    assert stats["profit"] == "-50.00"
