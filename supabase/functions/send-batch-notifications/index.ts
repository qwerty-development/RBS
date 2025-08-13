// supabase/functions/send-batch-notifications/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BatchNotificationPayload {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
  priority?: 'default' | 'high' | 'max';
  badge?: number;
  filters?: {
    platform?: 'ios' | 'android';
    minAppVersion?: string;
  };
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
    const payload: BatchNotificationPayload = await req.json()
    
    if (!payload.userIds || payload.userIds.length === 0 || !payload.title || !payload.body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userIds, title, body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Limit batch size to prevent abuse
    if (payload.userIds.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Batch size cannot exceed 1000 users' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Build query for push tokens
    let query = supabaseClient
      .from('user_push_tokens')
      .select('push_token, platform, user_id')
      .in('user_id', payload.userIds)
      .eq('is_active', true)

    // Apply filters if provided
    if (payload.filters?.platform) {
      query = query.eq('platform', payload.filters.platform)
    }

    const { data: tokens, error: tokensError } = await query

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
      console.log(`No active push tokens found for provided users`)
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
      channelId: 'default',
    }))

    // Split messages into chunks of 100 (Expo's limit)
    const chunks: ExpoMessage[][] = []
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100))
    }

    let totalSuccessCount = 0
    let totalErrorCount = 0
    const allErrors: string[] = []

    // Send each chunk to Expo Push API
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      
      try {
        const expoPushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        })

        if (!expoPushResponse.ok) {
          const errorText = await expoPushResponse.text()
          console.error(`Expo Push API error for chunk ${chunkIndex}:`, errorText)
          totalErrorCount += chunk.length
          allErrors.push(`Chunk ${chunkIndex}: ${errorText}`)
          continue
        }

        const expoPushResult = await expoPushResponse.json()
        console.log(`Expo Push API response for chunk ${chunkIndex}:`, expoPushResult)

        // Process results
        if (expoPushResult.data) {
          for (let i = 0; i < expoPushResult.data.length; i++) {
            const result = expoPushResult.data[i]
            const tokenIndex = chunkIndex * 100 + i
            
            if (result.status === 'ok') {
              totalSuccessCount++
            } else {
              totalErrorCount++
              allErrors.push(`Token ${tokenIndex}: ${result.message || 'Unknown error'}`)
              
              // If token is invalid, mark it as inactive
              if (result.details && result.details.error === 'DeviceNotRegistered') {
                const tokenToDeactivate = tokens[tokenIndex]
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
      } catch (chunkError) {
        console.error(`Error processing chunk ${chunkIndex}:`, chunkError)
        totalErrorCount += chunk.length
        allErrors.push(`Chunk ${chunkIndex}: ${chunkError.message}`)
      }

      // Add small delay between chunks to avoid rate limiting
      if (chunkIndex < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Log batch notification attempt
    await supabaseClient
      .from('notification_logs')
      .insert({
        user_id: null, // Batch notification
        title: payload.title,
        body: payload.body,
        data: { ...payload.data, batch: true, userCount: payload.userIds.length },
        tokens_sent: tokens.length,
        success_count: totalSuccessCount,
        error_count: totalErrorCount,
        errors: allErrors.length > 0 ? allErrors : null,
      })

    return new Response(
      JSON.stringify({
        message: 'Batch push notifications processed',
        usersTargeted: payload.userIds.length,
        tokensFound: tokens.length,
        sent: totalSuccessCount,
        failed: totalErrorCount,
        errors: allErrors.length > 0 ? allErrors.slice(0, 10) : undefined, // Limit error output
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in send-batch-notifications function:', error)
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

POST /functions/v1/send-batch-notifications
{
  "userIds": ["user-uuid-1", "user-uuid-2", "user-uuid-3"],
  "title": "Special Offer",
  "body": "20% off at your favorite restaurants this weekend!",
  "data": {
    "type": "offer",
    "campaignId": "weekend-special"
  },
  "priority": "default",
  "filters": {
    "platform": "ios"
  }
}
*/
