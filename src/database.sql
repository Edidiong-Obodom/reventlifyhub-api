CREATE DATABASE reventlify;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE
    company_funds (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        company_name TEXT NOT NULL,
        available_balance NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(3) NOT NULL DEFAULT 'ngn',
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN NOT NULL DEFAULT false
    );

CREATE TABLE
    limbo (
        email VARCHAR(255) UNIQUE NOT NULL,
        code VARCHAR(8) NOT NULL,
        status VARCHAR(7) NOT NULL,
        user_name VARCHAR(17) NOT NULL,
        password TEXT NOT NULL,
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN NOT NULL DEFAULT false
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
        bio TEXT,
        interests TEXT[] DEFAULT ARRAY[]::TEXT[],
        last_location_update TIMESTAMP,
        balance NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN NOT NULL DEFAULT false
    );

CREATE TABLE 
    followers (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        influencer TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE ON UPDATE CASCADE,
        follower TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE ON UPDATE CASCADE,
        is_deleted BOOLEAN NOT NULL DEFAULT false
    );

CREATE TABLE 
    conversations (
        id TEXT NOT NULL UNIQUE,
        client1_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE ON UPDATE CASCADE,
        client2_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE ON UPDATE CASCADE,
        is_deleted BOOLEAN NOT NULL DEFAULT false
    );
CREATE TABLE 
    messages (
        id TEXT NOT NULL UNIQUE,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE ON UPDATE CASCADE,
        sender_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE ON UPDATE CASCADE,
        message_text TEXT,
        message_media TEXT,
        message_media_id TEXT,
        delete_message BOOLEAN NOT NULL DEFAULT false,
        seen BOOLEAN NOT NULL DEFAULT false,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN NOT NULL DEFAULT false
    );

CREATE TABLE
    password_reset (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        email VARCHAR(255) UNIQUE NOT NULL REFERENCES clients (email),
        reset_code VARCHAR(8) NOT NULL,
        status VARCHAR(7) NOT NULL DEFAULT 'pending',
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN NOT NULL DEFAULT false
    );

CREATE TABLE
    regimes (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        creator_id TEXT NOT NULL REFERENCES clients (id),
        name VARCHAR(255) NOT NULL UNIQUE,
        venue TEXT,
        address TEXT NOT NULL,
        city VARCHAR(255) NOT NULL,
        state VARCHAR(255) NOT NULL,
        country VARCHAR(255) NOT NULL DEFAULT 'nigeria',
        withdrawal_pin TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        media TEXT NOT NULL,
        media_id TEXT NOT NULL,
        media_i TEXT,
        media_id_i TEXT,
        media_ii TEXT,
        media_id_ii TEXT,
        media_iii TEXT,
        media_id_iii TEXT,
        media_iv TEXT,
        media_id_iv TEXT,
        balance NUMERIC(17, 2) NOT NULL DEFAULT 0.00,
        affiliate BOOLEAN NOT NULL DEFAULT false,
        status VARCHAR(15) NOT NULL DEFAULT 'pending',
        start_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_date DATE NOT NULL,
        end_time TIME NOT NULL,
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN NOT NULL DEFAULT false
    );

CREATE TABLE
    regime_lineups (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        regime_id TEXT NOT NULL REFERENCES regimes (id) ON DELETE CASCADE ON UPDATE CASCADE,
        title VARCHAR(255) NOT NULL,
        performance_time TIME NOT NULL,
        image TEXT NOT NULL,
        image_id TEXT NOT NULL,
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN NOT NULL DEFAULT false
    );

CREATE TABLE
    regime_bookmarks (
        id TEXT PRIMARY KEY DEFAULT uuid_generate_v4 (),
        client_id TEXT NOT NULL REFERENCES clients (id) ON DELETE CASCADE ON UPDATE CASCADE,
        regime_id TEXT NOT NULL REFERENCES regimes (id) ON DELETE CASCADE ON UPDATE CASCADE,
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN NOT NULL DEFAULT false,
        CONSTRAINT unique_regime_bookmark UNIQUE (client_id, regime_id)
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN NOT NULL DEFAULT false
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT false
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
        is_deleted BOOLEAN NOT NULL DEFAULT false,
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN NOT NULL DEFAULT false
    );

-- Indexes
CREATE INDEX idx_client_id_clients ON clients (id);

CREATE INDEX idx_follower_id_followers ON followers (id);

CREATE INDEX idx_client_email_clients ON clients (email);

CREATE INDEX idx_client_email_pw_reset ON password_reset (email);

CREATE INDEX idx_message_id_messages ON messages (id);

CREATE INDEX idx_conversation_id_conversations ON conversations (id);

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

alter table regimes add column media_i TEXT,
        add column media_id_i TEXT,
        add column media_ii TEXT,
        add column media_id_ii TEXT,
        add column media_iii TEXT,
        add column media_id_iii TEXT,
        add column media_iv TEXT,
        add column media_id_iv TEXT;

ALTER TABLE clients
ADD COLUMN bio TEXT,
ADD COLUMN interests TEXT[] DEFAULT ARRAY[]::TEXT[];


-- New transaction handling flow BEGIN

-- ============================================================================
-- HELPER FUNCTIONS (No changes needed - already enhanced)
-- ============================================================================

-- Function to check and debit balance with locking
CREATE OR REPLACE FUNCTION debit_client_balance(
    p_client_id TEXT,
    p_amount NUMERIC(17, 2)
) RETURNS NUMERIC(17, 2) AS $$
DECLARE
    v_new_balance NUMERIC(17, 2);
BEGIN
    -- Lock the row and check balance in one atomic operation
    UPDATE clients
    SET balance = balance - p_amount
    WHERE id = p_client_id
      AND balance >= p_amount  -- Atomic check and update
    RETURNING balance INTO v_new_balance;
    
    IF NOT FOUND THEN
        DECLARE
            v_current_balance NUMERIC(17, 2);
        BEGIN
            SELECT balance INTO v_current_balance
            FROM clients
            WHERE id = p_client_id;
            
            RAISE EXCEPTION 'Insufficient balance for transaction. Client ID: %, Balance: %, Required: %',
                p_client_id, COALESCE(v_current_balance, 0), p_amount;
        END;
    END IF;
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to debit regime balance with locking
CREATE OR REPLACE FUNCTION debit_regime_balance(
    p_regime_id TEXT,
    p_amount NUMERIC(17, 2)
) RETURNS NUMERIC(17, 2) AS $$
DECLARE
    v_new_balance NUMERIC(17, 2);
BEGIN
    UPDATE regimes
    SET balance = balance - p_amount
    WHERE id = p_regime_id
      AND balance >= p_amount
    RETURNING balance INTO v_new_balance;
    
    IF NOT FOUND THEN
        DECLARE
            v_current_balance NUMERIC(17, 2);
        BEGIN
            SELECT balance INTO v_current_balance
            FROM regimes
            WHERE id = p_regime_id;
            
            RAISE EXCEPTION 'Insufficient balance for transaction. Regime ID: %, Balance: %, Required: %',
                p_regime_id, COALESCE(v_current_balance, 0), p_amount;
        END;
    END IF;
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to credit client balance
CREATE OR REPLACE FUNCTION credit_client_balance(
    p_client_id TEXT,
    p_amount NUMERIC(17, 2)
) RETURNS NUMERIC(17, 2) AS $$
DECLARE
    v_new_balance NUMERIC(17, 2);
BEGIN
    UPDATE clients
    SET balance = balance + p_amount
    WHERE id = p_client_id
    RETURNING balance INTO v_new_balance;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client not found: %', p_client_id;
    END IF;
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to credit regime balance
CREATE OR REPLACE FUNCTION credit_regime_balance(
    p_regime_id TEXT,
    p_amount NUMERIC(17, 2)
) RETURNS NUMERIC(17, 2) AS $$
DECLARE
    v_new_balance NUMERIC(17, 2);
BEGIN
    UPDATE regimes
    SET balance = balance + p_amount
    WHERE id = p_regime_id
    RETURNING balance INTO v_new_balance;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Regime not found: %', p_regime_id;
    END IF;
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to create credit transaction record
CREATE OR REPLACE FUNCTION create_credit_transaction(
    p_transaction RECORD,
    p_transaction_type TEXT,
    p_credited_balance NUMERIC(17, 2),
    p_client_id TEXT DEFAULT NULL,
    p_regime_id TEXT DEFAULT NULL,
    p_beneficiary TEXT DEFAULT NULL,
    p_company TEXT DEFAULT NULL,
    p_amount NUMERIC(17, 2) DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO transactions (
        client_id, regime_id, beneficiary, company, transaction_type, 
        actual_amount, currency, treated, transaction_reference,
        balance_after_transaction, is_recursion, transaction_action, 
        description, local_bank, local_account_no, local_account_name, 
        payment_gateway, status, parent
    )
    VALUES (
        p_client_id,
        p_regime_id,
        p_beneficiary,
        p_company,
        p_transaction_type,
        COALESCE(p_amount, p_transaction.amount),
        p_transaction.currency,
        TRUE,
        p_transaction.transaction_reference,
        p_credited_balance,
        TRUE,  -- Mark as recursion to prevent re-processing
        p_transaction.transaction_action,
        p_transaction.description,
        p_transaction.local_bank,
        p_transaction.local_account_no,
        p_transaction.local_account_name,
        p_transaction.payment_gateway,
        p_transaction.status,
        p_transaction.id
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER FUNCTIONS (Updated with your defensive pattern)
-- ============================================================================

-- Trigger 1: Handle INTRA-DEBIT (Client to Regime)
CREATE OR REPLACE FUNCTION handle_intra_debit_client_to_regime()
RETURNS TRIGGER AS $$
DECLARE
    v_debited_balance NUMERIC(17, 2);
    v_credited_balance NUMERIC(17, 2);
BEGIN
    -- ✅ Your defensive pattern: Only process untreated successful transactions
    IF NEW.treated IS NOT TRUE AND NEW.status = 'success' THEN
        
        -- Only handle intra-debit transactions
        IF NEW.transaction_type = 'intra-debit' THEN
            
            -- Only handle client -> regime transfers
            IF NEW.client_id IS NOT NULL AND NEW.regime_id IS NOT NULL AND NEW.beneficiary IS NULL THEN
                
                -- Debit client (with atomic balance check)
                v_debited_balance := debit_client_balance(NEW.client_id, NEW.amount);
                
                -- Credit regime
                v_credited_balance := credit_regime_balance(NEW.regime_id, NEW.amount);
                
                -- Create corresponding credit transaction
                PERFORM create_credit_transaction(
                    NEW,
                    'intra-credit',
                    v_credited_balance,
                    p_client_id := NEW.client_id,
                    p_regime_id := NEW.regime_id
                );
                
                -- Mark as treated and store balance
                NEW.treated := TRUE;
                NEW.balance_after_transaction := v_debited_balance;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger 2: Handle INTRA-DEBIT (Client to Client)
CREATE OR REPLACE FUNCTION handle_intra_debit_client_to_client()
RETURNS TRIGGER AS $$
DECLARE
    v_debited_balance NUMERIC(17, 2);
    v_credited_balance NUMERIC(17, 2);
BEGIN
    -- ✅ Your defensive pattern
    IF NEW.treated IS NOT TRUE AND NEW.status = 'success' THEN
        
        IF NEW.transaction_type = 'intra-debit' THEN
            
            -- Only handle client -> client transfers (no regime involved)
            IF NEW.client_id IS NOT NULL AND NEW.beneficiary IS NOT NULL AND NEW.regime_id IS NULL THEN
                
                -- Debit sender
                v_debited_balance := debit_client_balance(NEW.client_id, NEW.amount);
                
                -- Credit beneficiary
                v_credited_balance := credit_client_balance(NEW.beneficiary, NEW.amount);
                
                -- Create corresponding credit transaction
                PERFORM create_credit_transaction(
                    NEW,
                    'intra-credit',
                    v_credited_balance,
                    p_client_id := NEW.beneficiary,
                    p_beneficiary := NEW.client_id
                );
                
                -- Mark as treated
                NEW.treated := TRUE;
                NEW.balance_after_transaction := v_debited_balance;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger 3: Handle INTRA-DEBIT (Regime to Client)
CREATE OR REPLACE FUNCTION handle_intra_debit_regime_to_client()
RETURNS TRIGGER AS $$
DECLARE
    v_debited_balance NUMERIC(17, 2);
    v_credited_balance NUMERIC(17, 2);
BEGIN
    -- ✅ Your defensive pattern
    IF NEW.treated IS NOT TRUE AND NEW.status = 'success' THEN
        
        IF NEW.transaction_type = 'intra-debit' THEN
            
            -- Only handle regime -> client transfers
            IF NEW.regime_id IS NOT NULL AND NEW.beneficiary IS NOT NULL AND NEW.client_id IS NULL THEN
                
                -- Debit regime
                v_debited_balance := debit_regime_balance(NEW.regime_id, NEW.amount);
                
                -- Credit client
                v_credited_balance := credit_client_balance(NEW.beneficiary, NEW.amount);
                
                -- Create corresponding credit transaction
                PERFORM create_credit_transaction(
                    NEW,
                    'intra-credit',
                    v_credited_balance,
                    p_beneficiary := NEW.beneficiary,
                    p_regime_id := NEW.regime_id
                );
                
                -- Mark as treated
                NEW.treated := TRUE;
                NEW.balance_after_transaction := v_debited_balance;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger 4: Handle INTER-DEBIT (Client Withdrawal to Bank)
CREATE OR REPLACE FUNCTION handle_inter_debit_withdrawal()
RETURNS TRIGGER AS $$
DECLARE
    v_debited_balance NUMERIC(17, 2);
BEGIN
    -- ✅ Your defensive pattern
    IF NEW.treated IS NOT TRUE AND NEW.status = 'success' THEN
        
        IF NEW.transaction_type = 'inter-debit' THEN
            
            -- Only handle client withdrawals (client_id = beneficiary, money leaving system)
            IF NEW.client_id IS NOT NULL AND NEW.beneficiary IS NOT NULL 
               AND NEW.client_id = NEW.beneficiary AND NEW.regime_id IS NULL THEN
                
                -- Debit client
                v_debited_balance := debit_client_balance(NEW.client_id, NEW.amount);
                
                -- Mark as treated
                NEW.treated := TRUE;
                NEW.balance_after_transaction := v_debited_balance;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger 5: Handle INTER-DEBIT (Ticket Purchase via External Gateway)
CREATE OR REPLACE FUNCTION handle_inter_debit_ticket_purchase()
RETURNS TRIGGER AS $$
DECLARE
    v_credited_balance NUMERIC(17, 2);
    v_affiliate_balance NUMERIC(17, 2);
    v_company_balance NUMERIC(17, 2);
    v_company_id TEXT;
BEGIN
    -- ✅ Your defensive pattern
    -- This trigger fires when webhook updates transaction status to 'success'
    IF NEW.treated IS NOT TRUE AND NEW.status = 'success' THEN
        
        IF NEW.transaction_type = 'inter-debit' THEN
            
            -- Only handle ticket purchases (has regime_id, external payment)
            IF NEW.client_id IS NOT NULL AND NEW.regime_id IS NOT NULL THEN
                
                -- Credit regime with ticket revenue
                v_credited_balance := credit_regime_balance(NEW.regime_id, NEW.amount);
                
                -- Create credit transaction for regime
                PERFORM create_credit_transaction(
                    NEW,
                    'inter-credit',
                    v_credited_balance,
                    p_client_id := NEW.client_id,
                    p_regime_id := NEW.regime_id
                );
                
                -- Credit affiliate if commission exists
                IF NEW.affiliate_amount IS NOT NULL AND NEW.affiliate_amount > 0 AND NEW.affiliate_id IS NOT NULL THEN
                    v_affiliate_balance := credit_client_balance(NEW.affiliate_id, NEW.affiliate_amount);
                    
                    PERFORM create_credit_transaction(
                        NEW,
                        'inter-credit',
                        v_affiliate_balance,
                        p_client_id := NEW.client_id,
                        p_regime_id := NEW.regime_id,
                        p_beneficiary := NEW.affiliate_id,
                        p_amount := NEW.affiliate_amount
                    );
                END IF;
                
                -- Credit company with platform fees
                IF NEW.company_charge IS NOT NULL AND NEW.company_charge > 0 THEN
                    UPDATE company_funds
                    SET available_balance = available_balance + NEW.company_charge
                    WHERE currency ILIKE NEW.currency
                    RETURNING available_balance, id INTO v_company_balance, v_company_id;
                    
                    IF NOT FOUND THEN
                        RAISE EXCEPTION 'Company fund not found for currency: %', NEW.currency;
                    END IF;
                    
                    PERFORM create_credit_transaction(
                        NEW,
                        'inter-credit',
                        v_company_balance,
                        p_client_id := NEW.client_id,
                        p_regime_id := NEW.regime_id,
                        p_company := v_company_id,
                        p_amount := NEW.company_charge
                    );
                END IF;
                
                -- Mark as treated (no client balance change for external payment)
                NEW.treated := TRUE;
                NEW.balance_after_transaction := 0;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger 6: Handle INTER-CREDIT (External Money Coming In)
CREATE OR REPLACE FUNCTION handle_inter_credit()
RETURNS TRIGGER AS $$
DECLARE
    v_credited_balance NUMERIC(17, 2);
BEGIN
    -- ✅ Your defensive pattern
    IF NEW.treated IS NOT TRUE AND NEW.status = 'success' THEN
        
        IF NEW.transaction_type = 'inter-credit' THEN
            
            -- Skip if this is a recursion (auto-generated credit from triggers)
            IF NEW.is_recursion IS NOT TRUE THEN
                
                -- Credit the beneficiary if specified
                IF NEW.beneficiary IS NOT NULL THEN
                    v_credited_balance := credit_client_balance(NEW.beneficiary, NEW.amount);
                    
                    -- Mark as treated
                    NEW.treated := TRUE;
                    NEW.balance_after_transaction := v_credited_balance;
                END IF;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- REGISTER TRIGGERS
-- ============================================================================

-- Drop old triggers if they exist
DROP TRIGGER IF EXISTS trg_update_balance_and_create_credit ON transactions;
DROP TRIGGER IF EXISTS trg_01_intra_debit_client_to_regime ON transactions;
DROP TRIGGER IF EXISTS trg_02_intra_debit_client_to_client ON transactions;
DROP TRIGGER IF EXISTS trg_03_intra_debit_regime_to_client ON transactions;
DROP TRIGGER IF EXISTS trg_04_inter_debit_withdrawal ON transactions;
DROP TRIGGER IF EXISTS trg_05_inter_debit_ticket_purchase ON transactions;
DROP TRIGGER IF EXISTS trg_06_inter_credit ON transactions;

-- Create BEFORE triggers (execute in alphabetical order by trigger name)
CREATE TRIGGER trg_01_intra_debit_client_to_regime
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION handle_intra_debit_client_to_regime();

CREATE TRIGGER trg_02_intra_debit_client_to_client
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION handle_intra_debit_client_to_client();

CREATE TRIGGER trg_03_intra_debit_regime_to_client
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION handle_intra_debit_regime_to_client();

CREATE TRIGGER trg_04_inter_debit_withdrawal
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION handle_inter_debit_withdrawal();

CREATE TRIGGER trg_05_inter_debit_ticket_purchase
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION handle_inter_debit_ticket_purchase();

CREATE TRIGGER trg_06_inter_credit
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION handle_inter_credit();
-- New transaction handling flow END

```

## Key Changes Based on Your Pattern

1. **✅ Consistent defensive pattern**: `IF NEW.treated IS NOT TRUE AND NEW.status = 'success'`
2. **✅ NULL-safe checks**: Uses `IS NOT TRUE` instead of `= FALSE` (handles NULL correctly)
3. **✅ Specific conditionals**: Each trigger checks exact column combinations
4. **✅ Works with webhook flow**: Triggers fire when webhook updates status to 'success'
5. **✅ Better NULL handling**: Added `IS NOT NULL` checks before using affiliate/company amounts

## How It Works With Your Webhook Flow

1. API creates transaction with status='pending', treated=FALSE
2. User pays via Paystack
3. Webhook receives success event
4. Webhook updates transaction: status='success' (still treated=FALSE)
5. TRIGGER FIRES on UPDATE: sees treated=FALSE AND status='success'
6. Trigger processes accounting, sets treated=TRUE
7. Future webhook duplicates see treated=TRUE, skip processing ✅
```