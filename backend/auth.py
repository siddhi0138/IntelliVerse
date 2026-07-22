"""Full login wall: Postgres-backed users table + JWT bearer tokens.

This is the first thing in the backend to actually query Postgres — every
other module still reads/writes SQLite (catalog.py) or in-memory caches
(main.py). Password hashing goes straight through the `bcrypt` package
rather than passlib's bcrypt wrapper: passlib 1.7.4's version-sniffing
breaks against bcrypt>=4.1 (it reads a `__about__.__version__` attribute
bcrypt removed), so passlib buys an abstraction we don't need at the cost
of a real incompatibility.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import bcrypt
import psycopg2
from jose import JWTError, jwt

JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))
POSTGRES_DSN = os.environ["POSTGRES_DSN"]


class AuthError(Exception):
    pass


def _connect():
    # Mirrors catalog.py's pattern of ensuring the table exists on every
    # connection (idempotent CREATE TABLE IF NOT EXISTS) rather than
    # requiring a separate startup step.
    conn = psycopg2.connect(POSTGRES_DSN)
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
    conn.commit()
    return conn


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_user(username: str, password: str) -> None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT 1 FROM users WHERE username = %s", (username,))
        if cur.fetchone():
            raise AuthError("Username already taken.")
        cur.execute(
            "INSERT INTO users (username, password_hash) VALUES (%s, %s)",
            (username, hash_password(password)),
        )
        conn.commit()


def authenticate_user(username: str, password: str) -> bool:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT password_hash FROM users WHERE username = %s", (username,))
        row = cur.fetchone()
        if row is None:
            return False
        return verify_password(password, row[0])


def create_access_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    return jwt.encode({"sub": username, "exp": expire}, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise AuthError("Invalid or expired token.") from exc
    username = payload.get("sub")
    if not username:
        raise AuthError("Invalid token payload.")
    return username
