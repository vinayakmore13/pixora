-- Create a function to verify gallery password
CREATE OR REPLACE FUNCTION verify_gallery_password(p_event_id uuid, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stored_hash text;
BEGIN
    SELECT gallery_password_hash INTO v_stored_hash
    FROM events
    WHERE id = p_event_id;

    -- For simplicity in this demo, we'll do a direct string match or you could use pgcrypto for bcrypt
    -- If using pgcrypto: RETURN v_stored_hash = crypt(p_password, v_stored_hash);
    -- Here we assume the frontend sends the exact stored string (e.g. a share code)
    IF v_stored_hash IS NULL THEN
        RETURN false;
    END IF;

    RETURN v_stored_hash = p_password;
END;
$$;
