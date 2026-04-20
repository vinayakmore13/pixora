// @ts-ignore - Deno imports are not recognized by standard Node.js TypeScript configs
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Declare Deno global to prevent local TypeScript (Node/React config) from throwing errors
declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        )

        const { event_id, password } = await req.json()

        if (!event_id || !password) {
            return new Response(
                JSON.stringify({ error: 'Event ID and password are required' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                }
            )
        }

        // Fetch the event to get the hashed password
        const { data: event, error: eventError } = await supabaseClient
            .from('events')
            .select('id, upload_password, allow_guest_uploads')
            .eq('id', event_id)
            .single()

        if (eventError || !event) {
            return new Response(
                JSON.stringify({ error: 'Event not found' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404,
                }
            )
        }

        if (!event.allow_guest_uploads) {
            return new Response(
                JSON.stringify({ error: 'Guest uploads are not allowed for this event' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 403,
                }
            )
        }

        // Verify the password using bcrypt
        const passwordMatch = await bcrypt.compare(password, event.upload_password)

        if (!passwordMatch) {
            return new Response(
                JSON.stringify({ error: 'Invalid password' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 401,
                }
            )
        }

        // Generate a unique session token
        const sessionToken = crypto.randomUUID()

        // Set session expiration to 24 hours from now
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 24)

        // Create upload session
        const { data: session, error: sessionError } = await supabaseClient
            .from('upload_sessions')
            .insert({
                event_id: event_id,
                session_token: sessionToken,
                expires_at: expiresAt.toISOString(),
                is_valid: true,
            })
            .select()
            .single()

        if (sessionError) {
            return new Response(
                JSON.stringify({ error: 'Failed to create upload session' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500,
                }
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                session_token: sessionToken,
                expires_at: expiresAt.toISOString(),
                event_id: event_id,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})
