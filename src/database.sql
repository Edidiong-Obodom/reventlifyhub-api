CREATE DATABASE reventlify;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE
    company_funds (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        company_name TEXT NOT NULL,
        available_balance NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(3) NOT NULL DEFAULT 'ngn',
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE transactions (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent TEXT REFERENCES transactions(id),
    client_id TEXT REFERENCES clients(id),
    beneficiary TEXT REFERENCES clients(id), 
    regime_id TEXT REFERENCES regimes(id),
    affiliate_id TEXT REFERENCES clients(id),
    company TEXT REFERENCES company_funds(id),
    transaction_type TEXT NOT NULL DEFAULT 'intra-debit',
    CHECK (transaction_type IN ('inter-credit', 'inter-debit', 'intra-credit', 'intra-debit', 'free')),  -- Restricting values
    actual_amount NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
    balance_after_transaction NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
    company_charge NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
    payment_gateway_charge NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
    affiliate_amount NUMERIC(17, 2) DEFAULT 0.00,
    amount NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'ngn',
    transaction_reference TEXT,
    local_bank TEXT,
    local_account_no TEXT,
    local_account_name TEXT,
    is_recursion BOOLEAN NOT NULL DEFAULT FALSE,
    treated BOOLEAN NOT NULL DEFAULT FALSE,
    transaction_action TEXT DEFAULT 'ticket-purchase',
    description TEXT,
    status TEXT DEFAULT 'pending',
    payment_gateway TEXT NOT NULL DEFAULT 'internal',
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

-- Drop Only Tables (Without Dropping the Schema)
DO $$ 
BEGIN
   EXECUTE (
      SELECT string_agg('DROP TABLE IF EXISTS "' || tablename || '" CASCADE;', ' ')
      FROM pg_tables
      WHERE schemaname = 'public'
   );
END $$;

-- Drop the Entire Schema and Recreate It
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Best Option for Clearing Data Without Dropping Tables
DO $$ 
BEGIN
   EXECUTE (
      SELECT string_agg('TRUNCATE TABLE "' || tablename || '" RESTART IDENTITY CASCADE;', ' ')
      FROM pg_tables
      WHERE schemaname = 'public'
   );
END $$;


CREATE OR REPLACE FUNCTION update_balance_and_create_credit()
RETURNS TRIGGER AS $$
BEGIN
    -- Declare local variables to hold updated balances
    DECLARE
        debited_balance NUMERIC(17, 2) := 0.0;
        credited_balance NUMERIC(17, 2) := 0.0;
        company_balance NUMERIC(17, 2) := 0.0;
        affiliate_balance NUMERIC(17, 2) := 0.0;
        company_id TEXT;
    BEGIN
    IF NEW.treated IS NOT TRUE AND NEW.status = 'success' THEN
        -- Only process debit transactions
        IF NEW.transaction_type IN ('intra-debit') THEN

            IF NEW.client_id IS NOT NULL AND NEW.regime_id IS NOT NULL THEN
                -- Check if the client has enough balance before updating
                SELECT balance INTO debited_balance
                FROM clients
                WHERE id = NEW.client_id;

                IF debited_balance < NEW.amount THEN
                    RAISE EXCEPTION 'Insufficient balance for transaction. Client ID: %, Balance: %, Required: %',
                        NEW.client_id, debited_balance, NEW.amount;
                END IF;
                -- Update the balance of the client being debited and store the new balance
                UPDATE clients
                SET balance = balance - NEW.amount
                WHERE id = NEW.client_id
                RETURNING balance INTO debited_balance;

                -- Update the balance of the client being credited and store the new balance
                UPDATE regimes
                SET balance = balance + NEW.amount
                WHERE id = NEW.regime_id
                RETURNING balance INTO credited_balance;

                -- Create corresponding credit transaction for the beneficiary
                INSERT INTO transactions (
                    regime_id, client_id, transaction_type, actual_amount, currency, treated, transaction_reference,
                    balance_after_transaction, is_recursion, transaction_action, description, local_bank,
                    local_account_no, local_account_name, payment_gateway, status, parent
                )
                VALUES (
                    NEW.regime_id,               -- client_id for credit (beneficiary)
                    NEW.client_id,                 -- beneficiary for credit (debited client)
                    'intra-credit',                      -- intra-credit transaction type
                    NEW.amount,                    -- amount being credited
                    NEW.currency,                  -- currency
                    TRUE,
                    NEW.transaction_reference,     -- reference for the transaction
                    credited_balance,              -- Get the updated balance for the beneficiary
                    TRUE,                           -- Mark it as recursion to avoid it being processed again
                    NEW.transaction_action,
                    NEW.description,
                    NEW.local_bank,
                    NEW.local_account_no,
                    NEW.local_account_name,
                    NEW.payment_gateway,
                    NEW.status,
                    NEW.id
                );

                -- Set the balance after transaction for the debit transaction
                -- Explicitly update the treated column in the transactions table
                UPDATE transactions
                SET treated = TRUE, balance_after_transaction = debited_balance
                WHERE id = NEW.id;
            END IF;

            -- Regime debit
            IF NEW.client_id IS NOT NULL AND NEW.beneficiary IS NOT NULL THEN
                -- Check if the client has enough balance before updating
                SELECT balance INTO debited_balance
                FROM clients
                WHERE id = NEW.client_id;

                IF debited_balance < NEW.amount THEN
                    RAISE EXCEPTION 'Insufficient balance for transaction. Client ID: %, Balance: %, Required: %',
                        NEW.client_id, debited_balance, NEW.amount;
                END IF;
                -- Update the balance of the client being debited and store the new balance
                UPDATE clients
                SET balance = balance - NEW.amount
                WHERE id = NEW.client_id
                RETURNING balance INTO debited_balance;

                -- Update the balance of the client being credited and store the new balance
                UPDATE clients
                SET balance = balance + NEW.amount
                WHERE id = NEW.beneficiary
                RETURNING balance INTO credited_balance;

                -- Create corresponding credit transaction for the beneficiary
                    INSERT INTO transactions (
                        client_id, beneficiary, transaction_type, actual_amount, currency, treated, transaction_reference,
                        balance_after_transaction, is_recursion, transaction_action, description, local_bank,
                        local_account_no, local_account_name, payment_gateway, status, parent
                    )
                    VALUES (
                        NEW.beneficiary,               -- client_id for credit (beneficiary)
                        NEW.client_id,                 -- beneficiary for credit (debited client)
                        'intra-credit',                      -- intra-credit transaction type
                        NEW.amount,                    -- amount being credited
                        NEW.currency,                  -- currency
                        TRUE,
                        NEW.transaction_reference,     -- reference for the transaction
                        credited_balance,              -- Get the updated balance for the beneficiary
                        TRUE,                           -- Mark it as recursion to avoid it being processed again
                        NEW.transaction_action,
                        NEW.description,
                        NEW.local_bank,
                        NEW.local_account_no,
                        NEW.local_account_name,
                        NEW.payment_gateway,
                        NEW.status,
                        NEW.id
                    );

                -- Set the balance after transaction for the debit transaction
                -- Explicitly update the treated column in the transactions table
                UPDATE transactions
                SET treated = TRUE, balance_after_transaction = debited_balance
                WHERE id = NEW.id;
            END IF;

                -- Regime debit
            IF NEW.regime_id IS NOT NULL AND NEW.beneficiary IS NOT NULL THEN
                -- Check if the client has enough balance before updating
                SELECT balance INTO debited_balance
                FROM regimes
                WHERE id = NEW.regime_id;

                IF debited_balance < NEW.amount THEN
                    RAISE EXCEPTION 'Insufficient balance for transaction. Regime ID: %, Balance: %, Required: %',
                        NEW.regime_id, debited_balance, NEW.amount;
                END IF;
                -- Update the balance of the client being debited and store the new balance
                UPDATE regimes
                SET balance = balance - NEW.amount
                WHERE id = NEW.regime_id
                RETURNING balance INTO debited_balance;

                -- Update the balance of the client being credited and store the new balance
                UPDATE clients
                SET balance = balance + NEW.amount
                WHERE id = NEW.beneficiary
                RETURNING balance INTO credited_balance;

                -- Create corresponding credit transaction for the beneficiary
                INSERT INTO transactions (
                    beneficiary, regime_id, transaction_type, actual_amount, currency, treated, transaction_reference,
                    balance_after_transaction, is_recursion, transaction_action, description, local_bank,
                    local_account_no, local_account_name, payment_gateway, status, parent
                )
                VALUES (
                    NEW.beneficiary,               -- client_id for credit (beneficiary)
                    NEW.regime_id,                 -- beneficiary for credit (debited client)
                    'intra-credit',                      -- intra-credit transaction type
                    NEW.amount,                    -- amount being credited
                    NEW.currency,                  -- currency
                    TRUE,
                    NEW.transaction_reference,     -- reference for the transaction
                    credited_balance,              -- Get the updated balance for the beneficiary
                    TRUE,                           -- Mark it as recursion to avoid it being processed again
                    NEW.transaction_action,
                    NEW.description,
                    NEW.local_bank,
                    NEW.local_account_no,
                    NEW.local_account_name,
                    NEW.payment_gateway,
                    NEW.status,
                    NEW.id
                );

                -- Set the balance after transaction for the debit transaction
                -- Explicitly update the treated column in the transactions table
                UPDATE transactions
                SET treated = TRUE, balance_after_transaction = debited_balance
                WHERE id = NEW.id;
            END IF;
        END IF;

        -- Inter Debit
        IF NEW.transaction_type IN ('inter-debit') THEN
            -- Check if the client has enough balance before updating
            SELECT balance INTO debited_balance
            FROM clients
            WHERE id = NEW.client_id;
            -- Set balance after transaction for the client withdrawals to their local bank account
            IF NEW.client_id IS NOT NULL AND NEW.beneficiary IS NOT NULL AND NEW.client_id = NEW.beneficiary THEN
                -- Check if the client has enough balance before updating
                SELECT balance INTO debited_balance
                FROM clients
                WHERE id = NEW.client_id;

                IF debited_balance < NEW.amount THEN
                    RAISE EXCEPTION 'Insufficient balance for transaction. Client ID: %, Balance: %, Required: %',
                        NEW.client_id, debited_balance, NEW.amount;
                END IF;
                -- Update the balance of the client making the withdrawal and store the new balance
                UPDATE clients
                SET balance = balance - NEW.amount
                WHERE id = NEW.client_id
                RETURNING balance INTO debited_balance;

                -- Explicitly update the treated column in the transactions table
                UPDATE transactions
                SET treated = TRUE, balance_after_transaction = debited_balance
                WHERE id = NEW.id;
            END IF;

            -- Handles ticket purchase for external payment gateways
            IF NEW.client_id IS NOT NULL AND NEW.regime_id IS NOT NULL THEN

                -- Update the balance of the client being credited and store the new balance
                UPDATE regimes
                SET balance = balance + NEW.amount
                WHERE id = NEW.regime_id
                RETURNING balance INTO credited_balance;

                -- Create corresponding credit transaction for the beneficiary
                INSERT INTO transactions (
                    regime_id, client_id, transaction_type, actual_amount, currency, treated, transaction_reference,
                    balance_after_transaction, is_recursion, transaction_action, description, local_bank,
                    local_account_no, local_account_name, payment_gateway, status, parent
                )
                VALUES (
                    NEW.regime_id,               -- client_id for credit (beneficiary)
                    NEW.client_id,                 -- beneficiary for credit (debited client)
                    'inter-credit',                      -- inter-credit transaction type
                    NEW.amount,                    -- amount being credited
                    NEW.currency,                  -- currency
                    TRUE,
                    NEW.transaction_reference,     -- reference for the transaction
                    credited_balance,              -- Get the updated balance for the beneficiary
                    TRUE,                           -- Mark it as recursion to avoid it being processed again
                    NEW.transaction_action,
                    NEW.description,
                    NEW.local_bank,
                    NEW.local_account_no,
                    NEW.local_account_name,
                    NEW.payment_gateway,
                    NEW.status,
                    NEW.id
                );

                
                IF NEW.affiliate_amount > 0 THEN
                    -- Update the balance of the client being credited and store the new balance
                    UPDATE clients
                    SET balance = balance + NEW.affiliate_amount
                    WHERE id = NEW.affiliate_id
                    RETURNING balance INTO affiliate_balance;
                    -- Create corresponding credit transaction for the beneficiary
                    INSERT INTO transactions (
                        regime_id, client_id, beneficiary, transaction_type, actual_amount, currency, treated, transaction_reference,
                        balance_after_transaction, is_recursion, transaction_action, description, local_bank,
                        local_account_no, local_account_name, payment_gateway, status, parent
                    )
                    VALUES (
                        NEW.regime_id,               -- regime
                        NEW.client_id,                 -- (debited client)
                        NEW.affiliate_id,                 -- beneficiary for credit (credited client)
                        'inter-credit',                      -- inter-credit transaction type
                        NEW.affiliate_amount,                    -- amount being credited
                        NEW.currency,                  -- currency
                        TRUE,
                        NEW.transaction_reference,     -- reference for the transaction
                        affiliate_balance,              -- Get the updated balance for the beneficiary
                        TRUE,                           -- Mark it as recursion to avoid it being processed again
                        NEW.transaction_action,
                        NEW.description,
                        NEW.local_bank,
                        NEW.local_account_no,
                        NEW.local_account_name,
                        NEW.payment_gateway,
                        NEW.status,
                        NEW.id
                    );
                END IF;

                
                IF NEW.company_charge > 0 THEN
                    -- Update the balance of the client being credited and store the new balance
                    UPDATE company_funds
                    SET available_balance = available_balance + NEW.company_charge
                    WHERE currency ILIKE NEW.currency
                    RETURNING available_balance INTO company_balance;

                    SELECT id FROM company_funds WHERE currency ILIKE NEW.currency INTO company_id;
                    -- Create corresponding credit transaction for the beneficiary
                    INSERT INTO transactions (
                        regime_id, client_id, company, transaction_type, actual_amount, currency, treated, transaction_reference,
                        balance_after_transaction, is_recursion, transaction_action, description, local_bank,
                        local_account_no, local_account_name, payment_gateway, status, parent
                    )
                    VALUES (
                        NEW.regime_id,               -- regime
                        NEW.client_id,                 -- (debited client)
                        company_id,                 -- beneficiary for credit (credited client)
                        'inter-credit',                      -- inter-credit transaction type
                        NEW.company_charge,                    -- amount being credited
                        NEW.currency,                  -- currency
                        TRUE,
                        NEW.transaction_reference,     -- reference for the transaction
                        company_balance,              -- Get the updated balance for the beneficiary
                        TRUE,                           -- Mark it as recursion to avoid it being processed again
                        NEW.transaction_action,
                        NEW.description,
                        NEW.local_bank,
                        NEW.local_account_no,
                        NEW.local_account_name,
                        NEW.payment_gateway,
                        NEW.status,
                        NEW.id
                    );
                END IF;

                -- Explicitly update the treated column in the transactions table
                UPDATE transactions
                SET treated = TRUE, balance_after_transaction = debited_balance
                WHERE id = NEW.id;
            END IF;
        END IF;

        -- Set balance after transaction for the credited client
        IF NEW.transaction_type IN ('inter-credit') AND NEW.is_recursion IS NOT TRUE THEN
            -- Update balance for credited client (if the transaction is a credit)
            UPDATE clients
            SET balance = balance + NEW.amount
            WHERE id = NEW.beneficiary
            RETURNING balance INTO credited_balance;

            -- Explicitly update the treated column in the transactions table
            UPDATE transactions
            SET treated = TRUE, balance_after_transaction = credited_balance
            WHERE id = NEW.id;
            END IF;

        -- Return the updated transaction record
        RETURN NEW;
    END IF;
    -- Return the transaction record
    RETURN NEW;
    END;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function after inserting a new transaction
CREATE TRIGGER after_transaction_insert
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_balance_and_create_credit();

-- Create trigger to call the function after updating a transaction
CREATE TRIGGER after_transaction_update
AFTER UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_balance_and_create_credit();

-- delete trigger
DROP TRIGGER IF EXISTS after_transaction_update ON table_name;