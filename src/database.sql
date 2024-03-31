CREATE DATABASE reventlify;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE
    company_funds (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_name TEXT NOT NULL,
        available_balance NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    limbo (
        email VARCHAR(255) UNIQUE NOT NULL,
        code VARCHAR(8) NOT NULL,
        status VARCHAR(7) NOT NULL,
        user_name VARCHAR(17) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    clients (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        user_name VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        address TEXT,
        phone VARCHAR(15),
        city VARCHAR(255),
        state VARCHAR(255),
        country VARCHAR(255) DEFAULT 'Nigeria' NOT NULL,
        password TEXT NOT NULL,
        gender VARCHAR(6),
        photo TEXT,
        photo_id TEXT,
        balance NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Indexes
CREATE INDEX idx_client_id_clients ON client (id);