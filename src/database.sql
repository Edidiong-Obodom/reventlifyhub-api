CREATE DATABASE reventlify;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE
    company_funds (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        company_name TEXT NOT NULL,
        available_balance NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(3) NOT NULL DEFAULT 'ngn',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    limbo (
        email VARCHAR(255) UNIQUE NOT NULL,
        code VARCHAR(8) NOT NULL,
        status VARCHAR(7) NOT NULL,
        user_name VARCHAR(17) NOT NULL,
        password TEXT NOT NULL,
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    clients (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        user_name VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        address TEXT,
        phone VARCHAR(15),
        city VARCHAR(255),
        state VARCHAR(255),
        country VARCHAR(255) DEFAULT 'nigeria' NOT NULL,
        password TEXT NOT NULL,
        gender VARCHAR(6),
        photo TEXT,
        photo_id TEXT,
        balance NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    password_reset (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        email VARCHAR(255) UNIQUE NOT NULL REFERENCES clients (email),
        reset_code VARCHAR(8) NOT NULL,
        status VARCHAR(7) NOT NULL DEFAULT 'pending',
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    regimes (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        creator_id TEXT NOT NULL REFERENCES clients (id),
        name VARCHAR(255) NOT NULL UNIQUE,
        address TEXT NOT NULL,
        city VARCHAR(255) NOT NULL,
        state VARCHAR(255) NOT NULL,
        country VARCHAR(255) NOT NULL DEFAULT 'nigeria',
        withdrawal_pin TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        media TEXT NOT NULL,
        media_id TEXT NOT NULL,
        balance NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
        affiliate BOOLEAN NOT NULL DEFAULT false,
        status VARCHAR(15) NOT NULL DEFAULT 'pending',
        start_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_date DATE NOT NULL,
        end_time TIME NOT NULL,
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    pricings (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        regime_id TEXT NOT NULL REFERENCES regimes (id) ON DELETE CASCADE ON UPDATE CASCADE,
        name VARCHAR(255) NOT NULL,
        total_seats NUMERIC(17, 2) NOT NULL,
        available_seats NUMERIC(17, 2) NOT NULL,
        amount NUMERIC(17, 2) NOT NULL,
        affiliate_amount NUMERIC(17, 2) DEFAULT 0.00,
        new_participant_titles VARCHAR(20)[],
        affiliated_participants VARCHAR(20)[] NOT NULL DEFAULT ARRAY['affiliate', 'owner', 'creator', 'admin'],
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    transactions (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        client_id TEXT REFERENCES clients (id),
        regime_id TEXT REFERENCES regimes (id),
        transaction_type TEXT NOT NULL DEFAULT 'inter-credit',
        amount NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(3) NOT NULL DEFAULT 'ngn',
        transaction_reference TEXT,
        transaction_action TEXT DEFAULT 'ticket-purchase',
        description TEXT,
        status TEXT DEFAULT 'pending',
        payment_gateway TEXT NOT NULL DEFAULT 'RIP-Gateway',
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    regime_participant (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        participant_id TEXT NOT NULL REFERENCES clients (id) ON DELETE CASCADE ON UPDATE CASCADE,
        regime_id TEXT NOT NULL REFERENCES regimes (id) ON DELETE CASCADE ON UPDATE CASCADE,
        participant_role TEXT NOT NULL DEFAULT 'affiliate',
        balance NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_regime_and_unique_participant UNIQUE (regime_id, participant_id)
    );

CREATE TABLE
    tickets (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        pricing_id TEXT NOT NULL REFERENCES pricings (id) ON DELETE CASCADE ON UPDATE CASCADE,
        transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE CASCADE ON UPDATE CASCADE,
        buyer_id TEXT NOT NULL REFERENCES clients (id) ON DELETE CASCADE ON UPDATE CASCADE,
        owner_id TEXT NOT NULL REFERENCES clients (id) ON DELETE CASCADE ON UPDATE CASCADE,
        status TEXT NOT NULL,
        affiliate_id TEXT REFERENCES clients (id) ON DELETE CASCADE ON UPDATE CASCADE,
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Indexes
CREATE INDEX idx_client_id_clients ON clients (id);

CREATE INDEX idx_client_email_clients ON clients (email);

CREATE INDEX idx_client_email_pw_reset ON password_reset (email);

-- Functions
-- GetAllTicketsOwned Begins
CREATE OR REPLACE FUNCTION GetAllTicketsOwned(ownerId TEXT, pricingId TEXT)
RETURNS TABLE (
        client TEXT,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        regime_name VARCHAR(255),
        pricing_name VARCHAR(255),
        amount NUMERIC(17, 2),
        ticket_id TEXT,
        status TEXT
)
AS
$$
DECLARE
    regimeId TEXT;
BEGIN
    -- Get regime_id from pricings table
    SELECT regime_id INTO regimeId
    FROM pricings
    WHERE id = pricingId;

    -- Get 
    
    -- Return select from tickets based on owner_id and regime_id
    RETURN QUERY
    SELECT 
    clients.id as client,
    clients.first_name,
    clients.last_name,
    regimes.name as regime_name, 
    pricings.name as pricing_name, 
    pricings.amount,
    tickets.id as ticket_id,
    tickets.status
    FROM tickets
    JOIN pricings ON pricings.id = tickets.pricing_id
    JOIN regimes ON regimes.id = pricings.regime_id
    JOIN clients on clients.id = tickets.owner_id
    WHERE tickets.owner_id = ownerId 
    AND pricings.regime_id = regimeId;
END;
$$
LANGUAGE plpgsql;
--usage
SELECT * FROM GetAllTicketsOwned(
    '220d8073-447d-43e2-a2fc-e9f8a53b0f30',
    '4d3a8783-7b8d-4283-aa02-04a5ef331ca3'
);
--deletion
DROP FUNCTION getallticketsowned(text,text)
-- GetAllTicketsOwned Ends


DELETE FROM tickets;
DELETE FROM transactions;
UPDATE company_funds SET available_balance = 0 WHERE available_balance > 0;
UPDATE clients SET balance = 0 WHERE balance > 0;
UPDATE regimes SET balance = 0 WHERE balance > 0;
UPDATE pricings SET available_seats = total_seats WHERE available_seats > 0;