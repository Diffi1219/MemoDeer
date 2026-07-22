"""Test that UserOut.model_validate works with SQLAlchemy User"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.core.models import User
from app.core.schemas import UserOut
from datetime import datetime

# Simulate a user from DB (with int is_premium)
u = User(
    id="abc123",
    username="test",
    password_hash="hash",
    display_name="test",
    is_premium=1,  # SQLite returns int
    premium_type="monthly",
    premium_expire_at=None,
    created_at=datetime.utcnow(),
)

try:
    out = UserOut.model_validate(u)
    print(f"OK! is_premium={out.is_premium} (type={type(out.is_premium).__name__})")
    print(f"premium_type={out.premium_type}")
    print(f"TokenOut would serialize correctly")
except Exception as e:
    print(f"FAIL: {e}")
