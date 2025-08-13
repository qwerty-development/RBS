// supabase/functions/send-push-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
  priority?: 'default' | 'high' | 'max';
  badge?: number;
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  priority?: 'default' | 'high';
  badge?: number;
  channelId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    const payload: PushNotificationPayload = await req.json()
    
    if (!payload.userId || !payload.title || !payload.body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, title, body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user's push tokens
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('user_push_tokens')
      .select('push_token, platform')
      .eq('user_id', payload.userId)
      .eq('is_active', true)

    if (tokensError) {
      console.error('Error fetching push tokens:', tokensError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch push tokens' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!tokens || tokens.length === 0) {
      console.log(`No active push tokens found for user ${payload.userId}`)
      return new Response(
        JSON.stringify({ message: 'No active push tokens found', sent: 0 }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Prepare Expo push messages
    const messages: ExpoMessage[] = tokens.map(token => ({
      to: token.push_token,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      sound: payload.sound !== false ? 'default' : null,
      priority: payload.priority === 'high' ? 'high' : 'default',
      badge: payload.badge,
      channelId: 'default', // Android notification channel
    }))

    // Send notifications to Expo Push API
    const expoPushUrl = 'https://exp.host/--/api/v2/push/send'
    const expoPushResponse = await fetch(expoPushUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })

    if (!expoPushResponse.ok) {
      const errorText = await expoPushResponse.text()
      console.error('Expo Push API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to send push notifications' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const expoPushResult = await expoPushResponse.json()
    console.log('Expo Push API response:', expoPushResult)

    // Process results and handle errors
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    if (expoPushResult.data) {
      for (let i = 0; i < expoPushResult.data.length; i++) {
        const result = expoPushResult.data[i]
        if (result.status === 'ok') {
          successCount++
        } else {
          errorCount++
          errors.push(`Token ${i}: ${result.message || 'Unknown error'}`)
          
          // If token is invalid, mark it as inactive
          if (result.details && result.details.error === 'DeviceNotRegistered') {
            const tokenToDeactivate = tokens[i]
            if (tokenToDeactivate) {
              await supabaseClient
                .from('user_push_tokens')
                .update({ is_active: false })
                .eq('push_token', tokenToDeactivate.push_token)
              console.log(`Deactivated invalid token: ${tokenToDeactivate.push_token}`)
            }
          }
        }
      }
    }

    // Log notification attempt
    await supabaseClient
      .from('notification_logs')
      .insert({
        user_id: payload.userId,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        tokens_sent: tokens.length,
        success_count: successCount,
        error_count: errorCount,
        errors: errors.length > 0 ? errors : null,
      })

    return new Response(
      JSON.stringify({
        message: 'Push notifications processed',
        sent: successCount,
        failed: errorCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in send-push-notification function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/* 
Usage example:

POST /functions/v1/send-push-notification
{
  "userId": "user-uuid",
  "title": "Booking Confirmed",
  "body": "Your table at Restaurant Name is confirmed for tonight at 7:00 PM",
  "data": {
    "type": "booking",
    "bookingId": "booking-uuid",
    "restaurantId": "restaurant-uuid"
  },
  "priority": "high",
  "sound": true
}
*/
